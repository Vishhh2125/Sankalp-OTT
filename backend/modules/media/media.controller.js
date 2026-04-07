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

// Proxy HLS segments — generates presigned URLs for .m3u8 and .ts files
// This solves the CORS/auth issue: the player fetches from our API, we redirect to MinIO

async function hlsProxy(req, res, next) {
  try {
    const { episodeId } = req.params;
    const filename = req.params[0];
    const objectName = `hls/${episodeId}/${filename}`;

    const presignedUrl = await getPresignedGetUrl(objectName, 7200);

    if (filename.endsWith('.m3u8')) {
      const protocolModule = presignedUrl.startsWith('https') ? https : http;
      protocolModule.get(presignedUrl, (stream) => {
        let body = '';
        stream.on('data', chunk => body += chunk);
        stream.on('end', async () => {
          // Rewrite each .ts line to its own presigned URL (direct MinIO)
          const lines = body.split('\n');
          const rewritten = await Promise.all(lines.map(async (line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith('.ts')) {
              // Generate presigned URL directly for each segment
              const segObject = `hls/${episodeId}/${trimmed}`;
              return await getPresignedGetUrl(segObject, 7200);
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
      // .ts files: redirect directly to MinIO presigned URL
      // Browser downloads straight from MinIO — no Express bottleneck
      res.redirect(302, presignedUrl);
    }

  } catch (e) { next(e); }
}

export {
  getVideoUploadUrl, uploadVideo, getImageUploadUrl, confirmVideoUpload,
  confirmImageUpload, getPlayUrl, getTranscodeStatus, hlsProxy,
};
