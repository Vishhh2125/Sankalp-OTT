import * as mediaService from './media.service.js';
import { getPresignedGetUrl } from '../../utils/presigned-url.js';
import http from 'http';
import https from 'https';

function toHlsProxyPath(showId, episodeId, filename, childPath) {
  if (childPath.startsWith('/api/media/hls/')) return childPath;
  if (/^https?:\/\//i.test(childPath)) return childPath;

  const dir = filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/') + 1) : '';
  const resolvedPath = `${dir}${childPath}`.replace(/^\/+/, '');
  return `/api/media/hls/${showId}/${episodeId}/${resolvedPath}`;
}

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

async function uploadImage(req, res, next) {
  try {
    const result = await mediaService.uploadImageFile(req.body.type, req.body.entity_id, req.file);
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
    const result = await mediaService.getPlayUrl(req.params.episodeId, {
      userId: req.user?.id || null,
      isGuest: req.isGuest || false,
    });
    res.json(result);
  } catch (e) { next(e); }
}

async function getDownloadUrl(req, res, next) {
  try {
    const result = await mediaService.getDownloadUrl(req.params.episodeId, {
      userId: req.user?.id || null,
      isGuest: req.isGuest || false,
    });
    res.json(result);
  } catch (e) { next(e); }
}

async function getTranscodeStatus(req, res, next) {
  try {
    const result = await mediaService.getTranscodeStatus(req.params.episodeId);
    res.json(result);
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
        stream.on('end', () => {
          // Keep child playlists and segments on stable proxy paths so nginx can cache them.
          const lines = body.split('\n');
          const rewritten = lines.map((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith('.ts')) {
              return toHlsProxyPath(showId, episodeId, filename, trimmed);
            }
            if (trimmed && !trimmed.startsWith('#') && trimmed.endsWith('.m3u8')) {
              return toHlsProxyPath(showId, episodeId, filename, trimmed);
            }
            return line;
          });
          res.set('Content-Type', 'application/vnd.apple.mpegurl');
          res.set('Access-Control-Allow-Origin', '*');
          res.send(rewritten.join('\n'));
        });
        stream.on('error', next);
      }).on('error', next);

    } else {
      // .ts segments: stream through backend so nginx can cache the 200 response.
      const protocolModule = presignedUrl.startsWith('https') ? https : http;
      protocolModule.get(presignedUrl, (stream) => {
        if (stream.statusCode === 404) {
          return res.status(404).json({ error: 'Segment not found' });
        }
        if (stream.statusCode && stream.statusCode >= 400) {
          return res.status(stream.statusCode).json({ error: 'Segment fetch failed' });
        }
        res.set('Content-Type', stream.headers['content-type'] || 'video/mp2t');
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', '*');
        stream.pipe(res);
      }).on('error', next);
    }
  } catch (e) { next(e); }
}



// Image proxy — serves show thumbnails/banners through the backend
// so the mobile app never needs to reach MinIO directly.
// Route: GET /api/media/image/:showId/:type  (type = thumbnail | banner)
async function imageProxy(req, res, next) {
  try {
    const { showId, type } = req.params;
    console.log('[imageProxy] Request for showId:', showId, 'type:', type, 'full path:', req.originalUrl);
    
    if (!['thumbnail', 'banner'].includes(type)) {
      console.log('[imageProxy] Invalid type:', type);
      return res.status(400).json({ error: 'type must be thumbnail or banner' });
    }

    // Mirror the object name convention used when images are uploaded
    const ext = 'jpg';
    const objectName = `dramas/${showId}/${type}.${ext}`;
    console.log('[imageProxy] Fetching from MinIO:', objectName);
    
    const presignedUrl = await getPresignedGetUrl(objectName, 7200);
    console.log('[imageProxy] Got presigned URL, streaming to client...');

    // Stream the image through so the client only ever talks to our backend
    const protocolModule = presignedUrl.startsWith('https') ? https : http;
    protocolModule.get(presignedUrl, (stream) => {
      console.log('[imageProxy] MinIO response status:', stream.statusCode);
      
      if (stream.statusCode === 404) {
        console.log('[imageProxy] Image not found in MinIO');
        return res.status(404).json({ error: 'Image not found' });
      }
      res.set('Content-Type', stream.headers['content-type'] || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=3600');
      res.set('Access-Control-Allow-Origin', '*');
      console.log('[imageProxy] Streaming image to client');
      stream.pipe(res);
    }).on('error', (err) => {
      console.log('[imageProxy] Error fetching from MinIO:', err.message);
      next(err);
    });
  } catch (e) {
    console.log('[imageProxy] Exception:', e.message);
    next(e);
  }
}

export {
  getVideoUploadUrl, uploadVideo, uploadImage, getImageUploadUrl, confirmVideoUpload,
  confirmImageUpload, getPlayUrl, getDownloadUrl, getTranscodeStatus, hlsProxy, imageProxy,
};
