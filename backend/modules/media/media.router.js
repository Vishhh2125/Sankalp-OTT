import express from 'express';
import os from 'os';
import multer from 'multer';
import * as ctrl from './media.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import { allowGuest } from '../../middleware/auth.middleware.js';

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 * 1024, files: 1 },
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
});

// Admin uploads (dramas section)
router.post('/upload/video', requireAuth, requireAdmin('dramas'), upload.single('video'), ctrl.uploadVideo);
router.post('/upload/image', requireAuth, requireAdmin('dramas'), upload.single('image'), ctrl.uploadImage);
router.post('/upload-url/video', requireAuth, requireAdmin('dramas'), ctrl.getVideoUploadUrl);
router.post('/upload-url/image', requireAuth, requireAdmin('dramas'), ctrl.getImageUploadUrl);
router.post('/confirm/video', requireAuth, requireAdmin('dramas'), ctrl.confirmVideoUpload);
router.post('/confirm/image', requireAuth, requireAdmin('dramas'), ctrl.confirmImageUpload);

// Transcode status
router.get('/status/:episodeId', ctrl.getTranscodeStatus);

// HLS proxy
router.get('/hls/:showId/:episodeId/*', ctrl.hlsProxy);

// Playback URL
router.get('/play/:episodeId', allowGuest, ctrl.getPlayUrl);

// Download URL
router.get('/download-url/:episodeId', allowGuest, ctrl.getDownloadUrl);

// Image proxy
router.get('/image/:showId/:type', ctrl.imageProxy);

export default router;
