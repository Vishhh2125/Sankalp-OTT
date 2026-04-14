import express from 'express';
import os from 'os';
import multer from 'multer';
import * as ctrl from './media.controller.js';
import { devAdmin } from '../../middleware/dev-admin.middleware.js';
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

// Admin uploads
router.post('/upload/video', devAdmin('Dramas'), upload.single('video'), ctrl.uploadVideo);
router.post('/upload-url/video', devAdmin('Dramas'), ctrl.getVideoUploadUrl);
router.post('/upload-url/image', devAdmin('Dramas'), ctrl.getImageUploadUrl);
router.post('/confirm/video', devAdmin('Dramas'), ctrl.confirmVideoUpload);
router.post('/confirm/image', devAdmin('Dramas'), ctrl.confirmImageUpload);

// Transcode status
router.get('/status/:episodeId', ctrl.getTranscodeStatus);

// Image proxy — serves thumbnails/banners: /api/media/image/:type/:entityId
router.get('/image/:type/:entityId', ctrl.getImage);

// HLS proxy — new path: /api/media/hls/:showId/:episodeId/*
router.get('/hls/:showId/:episodeId/*', ctrl.hlsProxy);

// Playback URL
router.get('/play/:episodeId', allowGuest, ctrl.getPlayUrl);

export default router;
