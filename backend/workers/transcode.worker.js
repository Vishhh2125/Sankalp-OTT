import { Worker } from 'bullmq';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import redis from '../config/redis.js';
import minioClient from '../config/minio.js';
import config from '../config/index.js';
import { prisma } from '../prisma/client.js';
import { createMasterPlaylist } from '../master.js';

const BUCKET = config.minio.bucket;
const TEMP_DIR = path.join(os.tmpdir(), 'ott-transcode');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const PROFILES = [
  { name: '360p', width: 640, height: 360, bitrate: '800k', audio: '96k' },
  { name: '480p', width: 854, height: 480, bitrate: '1400k', audio: '128k' },
  { name: '720p', width: 1280, height: 720, bitrate: '2800k', audio: '128k' },
  { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', audio: '192k' },
];

const HLS_TIME = 6;

// ---------- HELPERS ----------

async function downloadFromMinio(objectName, localPath) {
  return new Promise((resolve, reject) => {
    minioClient.getObject(BUCKET, objectName, (err, stream) => {
      if (err) return reject(err);
      const file = fs.createWriteStream(localPath);
      stream.pipe(file);
      file.on('finish', () => resolve(localPath));
      file.on('error', reject);
    });
  });
}

async function uploadToMinio(localPath, objectName, contentType) {
  const stat = fs.statSync(localPath);
  await minioClient.putObject(
    BUCKET,
    objectName,
    fs.createReadStream(localPath),
    stat.size,
    { 'Content-Type': contentType }
  );
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else {
        console.error('[FFmpeg stderr tail]:', stderr.slice(-500));
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
    proc.on('error', (err) => reject(new Error(`FFmpeg spawn failed: ${err.message}`)));
  });
}

// ---------- MAIN JOB ----------

async function processJob(job) {
  const { episodeId, objectName, showId, profile } = job.data;

  const p = PROFILES.find(x => x.name === profile);
  if (!p) throw new Error('Invalid profile');

  const workDir = path.join(TEMP_DIR, episodeId);
  const inputPath = path.join(workDir, 'input.mp4');

  // MinIO base path per document: dramas/{showId}/episodes/{episodeId}/{profile}/
  const minioBasePath = `dramas/${showId}/episodes/${episodeId}/${p.name}`;

  try {
    console.log(`[Worker] Starting ${profile} for episode ${episodeId}`);

    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    // Download raw video (only once — subsequent profiles reuse the cached file)
    if (!fs.existsSync(inputPath)) {
      console.log(`[Worker] Downloading video from MinIO...`);
      await downloadFromMinio(objectName, inputPath);
      const sizeMB = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(1);
      console.log(`[Worker] Downloaded: ${sizeMB} MB`);
    }

    // Create profile-specific output directory
    const profileDir = path.join(workDir, p.name);
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    // Output: {workDir}/{profile}/index.m3u8 and {workDir}/{profile}/seg_000.ts
    const playlistPath = path.join(profileDir, 'index.m3u8');
    const segmentPattern = path.join(profileDir, 'seg_%03d.ts');

    const args = [
      '-i', inputPath,
      '-vf', `scale=${p.width}:${p.height}:force_original_aspect_ratio=decrease,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264', '-preset', 'medium', '-b:v', p.bitrate,
      '-c:a', 'aac', '-b:a', p.audio, '-ac', '2',
      '-f', 'hls',
      '-hls_time', String(HLS_TIME),
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', segmentPattern,
      '-y', playlistPath,
    ];

    console.log(`[Worker] FFmpeg encoding ${profile} (${p.width}x${p.height} @ ${p.bitrate})...`);
    await runFfmpeg(args);
    console.log(`[Worker] ${profile} encoding complete`);

    // Upload all files from profile directory to MinIO
    // Uploads to: dramas/{showId}/episodes/{episodeId}/{profile}/index.m3u8
    //             dramas/{showId}/episodes/{episodeId}/{profile}/seg_000.ts
    const files = fs.readdirSync(profileDir);
    console.log(`[Worker] Uploading ${files.length} files for ${profile}...`);

    for (const file of files) {
      const localFile = path.join(profileDir, file);
      const minioPath = `${minioBasePath}/${file}`;
      const ct = file.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/mp2t';
      await uploadToMinio(localFile, minioPath, ct);
    }
    console.log(`[Worker] ${profile} uploaded to MinIO at ${minioBasePath}/`);

    // Update DB — increment completed profiles
    const episode = await prisma.episode.update({
      where: { id: episodeId },
      data: {
        completed_profiles: { increment: 1 },
      },
    });

    console.log(`[Worker] ${profile} done. Progress: ${episode.completed_profiles}/${episode.total_profiles}`);

    // When all 4 profiles are done, create the master playlist
    if (
      episode.completed_profiles >= episode.total_profiles &&
      episode.status !== 'ready'
    ) {
      console.log(`[Worker] All profiles complete — creating master playlist...`);
      await createMasterPlaylist(episodeId);

      // Cleanup temp directory (all profiles done)
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
        console.log(`[Worker] Temp files cleaned up`);
      }
    }

    return { episodeId, profile, files: files.length };

  } catch (err) {
    console.error(`[Worker] FAILED ${profile} for ${episodeId}:`, err.message);
    throw err;
  }
}

// ---------- WORKER ----------

const worker = new Worker('transcode-queue', processJob, {
  connection: redis,
  concurrency: 2,
  lockDuration: 30 * 60 * 1000,
  lockRenewTime: 5 * 60 * 1000,
  maxStalledCount: 2,
  stalledInterval: 30 * 1000,
});

console.log('[Worker] Transcode worker starting...');

worker.on('ready', () => {
  console.log('[Worker] Transcode worker ready, waiting for jobs...');
});

worker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} FAILED:`, {
    profile: job.data?.profile,
    episode: job.data?.episodeId,
    error: err.message,
  });
});

worker.on('stalled', (jobId) => {
  console.error(`[Worker] Job ${jobId} STALLED`);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});
