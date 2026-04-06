const fs = require('fs');
const { prisma } = require('../../prisma/client');
const { createTranscodeJobs } = require('../../producer');
const { getPresignedPutUrl, getPresignedGetUrl, getPublicUrl } = require('../../utils/presigned-url');
const { AppError } = require('../../middleware/error.middleware');
const minioClient = require('../../config/minio');
const config = require('../../config');

// Get presigned PUT URL for uploading video to MinIO
async function getVideoUploadUrl(showId, episodeId) {
  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!episode) throw new AppError('Episode not found', 404);
  if (episode.show_id !== showId) throw new AppError('Episode does not belong to this show', 400);

  const objectName = `raw/${episodeId}/video.mp4`;
  const uploadUrl = await getPresignedPutUrl(objectName, 3600);

  return { upload_url: uploadUrl, object_name: objectName, episode_id: episodeId };
}

async function uploadVideoFile(showId, episodeId, file) {
  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!episode) throw new AppError('Episode not found', 404);
  if (episode.show_id !== showId) throw new AppError('Episode does not belong to this show', 400);

  const objectName = `raw/${episodeId}/video.mp4`;
  const metaData = {
    'Content-Type': file.mimetype || 'video/mp4'
  };
  await minioClient.fPutObject(config.minio.bucket, objectName, file.path, metaData);

  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      status: 'processing',
      total_profiles: 4,
      completed_profiles: 0,
    },
  });

  await createTranscodeJobs(episodeId, objectName);
  fs.unlink(file.path, () => {});

  return { episode_id: episodeId, status: 'processing', profiles_queued: 4 };
}

// Get presigned PUT URL for uploading thumbnail/banner
async function getImageUploadUrl(type, entityId) {
  const ext = 'jpg';
  let objectName;

  if (type === 'thumbnail') objectName = `thumbnails/${entityId}/thumb.${ext}`;
  else if (type === 'banner') objectName = `banners/${entityId}/banner.${ext}`;
  else if (type === 'collection') objectName = `collections/${entityId}/cover.${ext}`;
  else throw new AppError('Invalid upload type', 400);

  const uploadUrl = await getPresignedPutUrl(objectName, 900);
  const publicUrl = getPublicUrl(objectName);

  return { upload_url: uploadUrl, public_url: publicUrl, object_name: objectName };
}

// Called after video upload completes — enqueues transcode jobs
async function confirmVideoUpload(episodeId) {
  console.log('[Media] confirmVideoUpload called for episode:', episodeId);
  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!episode) throw new AppError('Episode not found', 404);

  const objectName = `raw/${episodeId}/video.mp4`;

  // Update status to processing and initialize profile counters
  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      status: 'processing',
      total_profiles: 4,
      completed_profiles: 0
    },
  });

  // Create parallel transcode jobs for each profile
  await createTranscodeJobs(episodeId, objectName);

  console.log(`[Media] Transcode jobs enqueued for episode ${episodeId}`);

  return { episode_id: episodeId, status: 'processing', profiles_queued: 4 };
}

// Confirm image upload — save URL to database
async function confirmImageUpload(type, entityId, objectName) {
  const publicUrl = getPublicUrl(objectName);

  if (type === 'thumbnail') {
    return prisma.show.update({ where: { id: entityId }, data: { thumbnail_url: publicUrl } });
  } else if (type === 'banner') {
    return prisma.show.update({ where: { id: entityId }, data: { banner_url: publicUrl } });
  }

  return { updated: true, url: publicUrl };
}

// Get presigned streaming URL for an episode
async function getPlayUrl(episodeId) {
  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!episode) throw new AppError('Episode not found', 404);
  if (!episode.hls_master_url) throw new AppError('Video not available yet', 404);
  if (episode.status !== 'ready') throw new AppError(`Video is ${episode.status}`, 400);

  // For HLS, we need to serve the master.m3u8 and make segments accessible
  // Generate presigned URL for master playlist
  const masterUrl = await getPresignedGetUrl(episode.hls_master_url, 7200);

  return {
    stream_url: masterUrl,
    duration_sec: episode.duration_sec,
    episode_id: episode.id,
    episode_num: episode.episode_num,
    status: episode.status,
  };
}

// Get transcode job status
async function getTranscodeStatus(episodeId) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      status: true,
      hls_master_url: true,
      duration_sec: true,
      total_profiles: true,
      completed_profiles: true
    },
  });
  if (!episode) throw new AppError('Episode not found', 404);

  const progress = episode.total_profiles > 0
    ? Math.round((episode.completed_profiles / episode.total_profiles) * 100)
    : 0;

  return {
    ...episode,
    progress_percentage: progress,
    profiles_completed: episode.completed_profiles,
    profiles_total: episode.total_profiles,
  };
}

module.exports = {
  getVideoUploadUrl,
  uploadVideoFile,
  getImageUploadUrl,
  confirmVideoUpload,
  confirmImageUpload,
  getPlayUrl,
  getTranscodeStatus,
};
