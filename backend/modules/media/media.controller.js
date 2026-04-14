import * as mediaService from './media.service.js';
import { getPresignedGetUrl } from '../../utils/presigned-url.js';
import http from 'http';
import https from 'https';

async function getVideoUploadUrl(req, res, next) {
  try {
    const result = await mediaService.getVideoUploadUrl(req.body.show_id, req.body.episode_id);
    res.json(result);
  } catch (e) { next(e); }
}

async function uploadVideo(req, res, next) {
  try {
    if (!req.file) throw new Error('No video file provided');
    const result = await mediaService.uploadVideoFile(req.body.show_id, req.body.episode_id, req.file);
    res.json(result);
  } catch (e) { next(e); }
}

async function getImageUploadUrl(req, res, next) {
  try {
    const result = await mediaService.getImageUploadUrl(req.body.type, req.body.entity_id);
    res.json(result);
  } catch (e) { next(e); }
}

async function confirmVideoUpload(req, res, next) {
  try {
    const result = await mediaService.confirmVideoUpload(req.body.episode_id);
    res.json(result);
  } catch (e) { next(e); }
}

async function confirmImageUpload(req, res, next) {
  try {
    const { type, entity_id, object_name } = req.body;
    const result = await mediaService.confirmImageUpload(type, entity_id, object_name);
    res.json(result);
  } catch (e) { next(e); }
}

async function getPlayUrl(req, res, next) {
  try {
    const result = await mediaService.getPlayUrl(req.params.episodeId);
    res.json(result);
  } catch (e) { next(e); }
}

async function getTranscodeStatus(req, res, next) {
  try {
    const result = await mediaService.getTranscodeStatus(req.params.episodeId);
    res.json(result);
  } catch (e) { next(e); }
}

// Image proxy — serves thumbnails/banners from MinIO to clients that can't reach localhost
async function getImage(req, res, next) {
  try {
    const result = await mediaService.getImageProxy(req.params.type, req.params.entityId);
    res.redirect(302, result.presigned_url);
  } catch (e) { next(e); }
}

// HLS Proxy — serves .m3u8 and .ts files from MinIO
// New path structure: dramas/{showId}/episodes/{episodeId}/...
// Route: /api/media/hls/:showId/:episodeId/*
async function hlsProxy(req, res, next) {
  try {
    const { showId, episodeId } = req.params;
    const filename = req.params[0]; // everything after /hls/:showId/:episodeId/
    const objectName = `dramas/${showId}/episodes/${episodeId}/${filename}`;

    const presignedUrl = await getPresignedGetUrl(objectName, 7200);

    if (filename.endsWith('.m3u8')) {
      const protocolModule = presignedUrl.startsWith('https') ? https : http;
      protocolModule.get(presignedUrl, (stream) => {
        let body = '';
        stream.on('data', chunk => body += chunk);
        stream.on('end', async () => {
          // Rewrite .ts segment references to presigned MinIO URLs (direct download)
          const lines = body.split('\n');
          const rewritten = await Promise.all(lines.map(async (line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith('.ts')) {
              // Get the directory of the current .m3u8 to resolve relative paths
              const dir = filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/') + 1) : '';
              const segObject = `dramas/${showId}/episodes/${episodeId}/${dir}${trimmed}`;
              return await getPresignedGetUrl(segObject, 7200);
            }
            if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith('.m3u8')) {
              // Rewrite sub-playlist references to go through our proxy
              return `/api/media/hls/${showId}/${episodeId}/${trimmed}`;
            }
            return line;
          }));
          res.set('Content-Type', 'application/vnd.apple.mpegurl');
          res.set('Access-Control-Allow-Origin', '*');
          res.send(rewritten.join('\n'));
        });
        stream.on('error', next);
      }).on('error', next);

    } else {
      // .ts segments: 302 redirect to MinIO presigned URL (bypasses Express)
      res.redirect(302, presignedUrl);
    }
  } catch (e) { next(e); }
}

export {
  getVideoUploadUrl, uploadVideo, getImageUploadUrl, confirmVideoUpload,
  confirmImageUpload, getPlayUrl, getTranscodeStatus, getImage, hlsProxy,
};
