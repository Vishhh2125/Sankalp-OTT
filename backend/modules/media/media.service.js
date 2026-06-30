import fs from 'fs';
import { prisma } from '../../prisma/client.js';
import { createTranscodeJobs } from '../../producer.js';
import { getPresignedPutUrl, getPublicUrl } from '../../utils/presigned-url.js';
import { getSignedEpisodeHlsPath, getSignedDownloadUrl } from '../../utils/hls-signed-url.js';
import { checkEpisodeAccess } from '../user/episode-access.service.js';
import { AppError } from '../../middleware/error.middleware.js';
import minioClient from '../../config/minio.js';
import config from '../../config/index.js';

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

  try {
    // Upload to MinIO with extended timeout
    await minioClient.fPutObject(config.minio.bucket, objectName, file.path, metaData);

    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        status: 'processing',
        total_profiles: 4,
        completed_profiles: 0,
      },
    });

    await createTranscodeJobs(episodeId, objectName, episode.show_id);
    
    // Clean up temp file
    fs.unlink(file.path, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    console.log(`Video uploaded to MinIO: ${objectName}, size: ${file.size} bytes`);
    return { episode_id: episodeId, status: 'processing', profiles_queued: 4 };
  } catch (err) {
    // Clean up temp file on error
    fs.unlink(file.path, (deleteErr) => {
      if (deleteErr) console.error('Failed to delete temp file after error:', deleteErr);
    });
    throw new AppError(`Video upload failed: ${err.message}`, 500);
  }
}

// Get presigned PUT URL for uploading thumbnail/banner
async function getImageUploadUrl(type, entityId) {
  const objectName = getImageObjectName(type, entityId);

  const uploadUrl = await getPresignedPutUrl(objectName, 900);
  const publicUrl = getPublicUrl(objectName);

  return { upload_url: uploadUrl, public_url: publicUrl, object_name: objectName };
}

function getImageObjectName(type, entityId) {
  const ext = 'jpg';

  if (type === 'thumbnail') return `dramas/${entityId}/thumbnail.${ext}`;
  if (type === 'banner') return `dramas/${entityId}/banner.${ext}`;
  if (type === 'collection') return `collections/${entityId}/cover.${ext}`;

  throw new AppError('Invalid upload type', 400);
}

async function uploadImageFile(type, entityId, file) {
  if (!file) throw new AppError('No image file provided', 400);

  if (type === 'thumbnail' || type === 'banner') {
    const show = await prisma.show.findUnique({ where: { id: entityId } });
    if (!show) throw new AppError('Show not found', 404);
  }

  const objectName = getImageObjectName(type, entityId);
  const metaData = {
    'Content-Type': file.mimetype || 'image/jpeg'
  };

  try {
    await minioClient.fPutObject(config.minio.bucket, objectName, file.path, metaData);

    const updated = await confirmImageUpload(type, entityId, objectName);
    const publicUrl = getPublicUrl(objectName);

    fs.unlink(file.path, (err) => {
      if (err) console.error('Failed to delete temp image file:', err);
    });

    console.log(`Image uploaded to MinIO: ${objectName}, size: ${file.size} bytes`);
    return { type, entity_id: entityId, object_name: objectName, public_url: publicUrl, updated };
  } catch (err) {
    fs.unlink(file.path, (deleteErr) => {
      if (deleteErr) console.error('Failed to delete temp image file after error:', deleteErr);
    });
    throw new AppError(`Image upload failed: ${err.message}`, 500);
  }
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
  await createTranscodeJobs(episodeId, objectName, episode.show_id);

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
async function getPlayUrl(episodeId, { userId = null, isGuest = false } = {}) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { show: { select: { category_id: true } } },
  });
  if (!episode) throw new AppError('Episode not found', 404);
  if (episode.video_source !== 'YOUTUBE' && !episode.hls_master_url) throw new AppError('Video not available yet', 404);
  if (episode.status !== 'ready') throw new AppError(`Video is ${episode.status}`, 400);

  const access = await checkEpisodeAccess(
    userId,
    isGuest,
    episode.id,
    episode.is_free,
    episode.show?.category_id
  );
  if (access.is_locked) {
    throw new AppError('Episode is locked', 403);
  }

  if (episode.video_source === 'YOUTUBE') {
    return {
      stream_url: null,
      video_source: 'YOUTUBE',
      youtube_video_id: episode.youtube_video_id,
      duration_sec: episode.duration_sec,
      episode_id: episode.id,
      episode_num: episode.episode_num,
      status: episode.status,
    };
  }

  return {
    stream_url: getSignedEpisodeHlsPath(episode),
    video_source: 'UPLOAD',
    duration_sec: episode.duration_sec,
    episode_id: episode.id,
    episode_num: episode.episode_num,
    status: episode.status,
  };
}

// Get presigned download URL for an episode
async function getDownloadUrl(episodeId, { userId = null, isGuest = false } = {}) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { show: { select: { category_id: true, title: true, thumbnail_url: true } } },
  });
  if (!episode) throw new AppError('Episode not found', 404);
  if (episode.video_source === 'YOUTUBE') throw new AppError('YouTube videos cannot be downloaded', 400);
  if (episode.status !== 'ready') throw new AppError(`Video is ${episode.status}`, 400);

  const access = await checkEpisodeAccess(
    userId,
    isGuest,
    episode.id,
    episode.is_free,
    episode.show?.category_id
  );
  if (access.is_locked) {
    throw new AppError('Episode is locked', 403);
  }

  return {
    download_url: getSignedDownloadUrl(episode.id),
    episode_id: episode.id,
    episode_num: episode.episode_num,
    title: episode.title || `Episode ${episode.episode_num}`,
    show_name: episode.show?.title || '',
    thumbnail_url: episode.show?.thumbnail_url || null,
    duration_sec: episode.duration_sec,
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
      completed_profiles: true,
      video_source: true
    },
  });
  if (!episode) throw new AppError('Episode not found', 404);

  if (episode.video_source === 'YOUTUBE') {
    return {
      ...episode,
      progress_percentage: 100,
      profiles_completed: 4,
      profiles_total: 4,
    };
  }

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

export {
  getVideoUploadUrl,
  uploadVideoFile,
  getImageUploadUrl,
  uploadImageFile,
  confirmVideoUpload,
  confirmImageUpload,
  getPlayUrl,
  getDownloadUrl,
  getTranscodeStatus,
};
