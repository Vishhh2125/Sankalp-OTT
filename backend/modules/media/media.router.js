import express from 'express';
import os from 'os';
import multer from 'multer';
import * as ctrl from './media.controller.js';
import { devAdmin } from '../../middleware/dev-admin.middleware.js';
import { allowGuest } from '../../middleware/auth.middleware.js';

const router = express.Router();

// Configure multer for large video file uploads (up to 5GB)
const uploadVideo = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB
    files: 1,
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
});

// Configure multer for image uploads (up to 10MB)
const uploadImage = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
});

// Admin uploads
router.post('/upload/video', devAdmin('Dramas'), uploadVideo.single('video'), ctrl.uploadVideo);
router.post('/upload/image', devAdmin('Dramas'), uploadImage.single('image'), ctrl.uploadImage);
router.post('/upload-url/video', devAdmin('Dramas'), ctrl.getVideoUploadUrl);
router.post('/upload-url/image', devAdmin('Dramas'), ctrl.getImageUploadUrl);
router.post('/confirm/video', devAdmin('Dramas'), ctrl.confirmVideoUpload);
router.post('/confirm/image', devAdmin('Dramas'), ctrl.confirmImageUpload);

// Transcode status
router.get('/status/:episodeId', ctrl.getTranscodeStatus);

// HLS proxy — serves .m3u8 and .ts files with presigned URLs
// No auth required (segments are already protected by presigned URL expiry)
router.get('/hls/:episodeId/*', ctrl.hlsProxy);

// Playback URL
router.get('/play/:episodeId', allowGuest, ctrl.getPlayUrl);

export default router;
