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
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed ${code}`));
    });
  });
}

// ---------- MAIN JOB ----------

async function processJob(job) {
  const { episodeId, objectName, profile } = job.data;

  const p = PROFILES.find(x => x.name === profile);
  if (!p) throw new Error('Invalid profile');

  const workDir = path.join(TEMP_DIR, episodeId);
  const inputPath = path.join(workDir, 'input.mp4');

  try {
    console.log(`[Worker] 📹 Starting transcoding for ${profile}...`);
    
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    // Download once
    if (!fs.existsSync(inputPath)) {
      console.log(`[Worker] ⬇️  Downloading video from MinIO...`);
      await downloadFromMinio(objectName, inputPath);
      console.log(`[Worker] ✅ Video downloaded`);
    }

    const hlsDir = path.join(workDir, 'hls');
    if (!fs.existsSync(hlsDir)) fs.mkdirSync(hlsDir);

    const playlistPath = path.join(hlsDir, `${p.name}.m3u8`);
    const segmentPattern = path.join(hlsDir, `${p.name}_%03d.ts`);

    const args = [
      '-i', inputPath,
      '-vf', `scale=${p.width}:${p.height}:force_original_aspect_ratio=decrease,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264', '-preset', 'medium', '-b:v', p.bitrate,
      '-c:a', 'aac', '-b:a', p.audio,
      '-f', 'hls',
      '-hls_time', String(HLS_TIME),
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', segmentPattern,
      '-y', playlistPath,
    ];

    console.log(`[Worker] 🎬 FFmpeg encoding ${profile} - bitrate ${p.bitrate}...`);
    await runFfmpeg(args);
    console.log(`[Worker] ✅ FFmpeg encoding complete for ${profile}`);

    // Upload files
    const files = fs.readdirSync(hlsDir).filter(f => f.startsWith(p.name));
    console.log(`[Worker] 📤 Uploading ${files.length} files for ${profile}...`);

    for (const file of files) {
      const localFile = path.join(hlsDir, file);
      const minioPath = `hls/${episodeId}/${file}`;
      const ct = file.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/mp2t';

      await uploadToMinio(localFile, minioPath, ct);
    }
    console.log(`[Worker] ✅ All files uploaded for ${profile}`);

    // Update DB
    const episode = await prisma.episode.update({
      where: { id: episodeId },
      data: {
        completed_profiles: { increment: 1 },
      },
    });

    // Final step
    if (
      episode.completed_profiles >= episode.total_profiles &&
      episode.status !== 'ready'
    ) {
      await createMasterPlaylist(episodeId);
    }

    return { episodeId, profile };

  } catch (err) {
    console.error(`[Worker] ❌ Error processing ${profile}:`, {
      profile,
      episodeId,
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

// ---------- WORKER ----------

const worker = new Worker('transcode-queue', processJob, {
  connection: redis,
  concurrency: 4, // Reduce to 2 for CPU-intensive FFmpeg tasks
  lockDuration: 30 * 60 * 1000, // 30 minutes - long enough for transcoding
  lockRenewTime: 5 * 60 * 1000, // Renew lock every 5 minutes
  maxStalledCount: 2, // Allow 2 stall attempts before failing
  stalledInterval: 30 * 1000, // Check for stalled jobs every 30 seconds
});

console.log('[Worker] Transcode worker starting...');

worker.on('ready', () => {
  console.log('[Worker] Transcode worker ready, waiting for jobs...');
});

worker.on('completed', (job, result) => {
  console.log(`[Worker] ✅ Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Job ${job.id} FAILED:`, {
    profile: job.data?.profile,
    episode: job.data?.episodeId,
    error: err.message,
    stack: err.stack
  });
});

worker.on('stalled', (jobId) => {
  console.error(`[Worker] ⚠️  Job ${jobId} STALLED - potentially hung process`);
});

worker.on('error', (err) => {
  console.error('[Worker] ⚠️  Worker error:', err.message);
});

