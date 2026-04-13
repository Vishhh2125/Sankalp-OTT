import fs from 'fs';
import path from 'path';
import os from 'os';
import minioClient from './config/minio.js';
import config from './config/index.js';
import { prisma } from './prisma/client.js';

const BUCKET = config.minio.bucket;
const TEMP_DIR = path.join(os.tmpdir(), 'ott-transcode');

async function createMasterPlaylist(episodeId) {
  // Get episode to find showId for the path
  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!episode) throw new Error('Episode not found');

  const showId = episode.show_id;
  const basePath = `dramas/${showId}/episodes/${episodeId}`;

  const content = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '',
    '#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360',
    '360p/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=1528000,RESOLUTION=854x480',
    '480p/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2928000,RESOLUTION=1280x720',
    '720p/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=5192000,RESOLUTION=1920x1080',
    '1080p/index.m3u8',
  ].join('\n');

  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const tempPath = path.join(TEMP_DIR, `${episodeId}_master.m3u8`);
  fs.writeFileSync(tempPath, content);

  const stat = fs.statSync(tempPath);
  const minioPath = `${basePath}/master.m3u8`;

  await minioClient.putObject(
    BUCKET,
    minioPath,
    fs.createReadStream(tempPath),
    stat.size,
    { 'Content-Type': 'application/vnd.apple.mpegurl' }
  );

  // Get duration from ffprobe if not already set
  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      status: 'ready',
      hls_master_url: minioPath,
    },
  });

  fs.unlinkSync(tempPath);
  console.log(`[Master] Playlist created: ${minioPath}`);
}

export { createMasterPlaylist };
