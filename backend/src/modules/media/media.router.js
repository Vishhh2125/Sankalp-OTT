const express = require('express');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const ctrl = require('./media.controller');
const { devAdmin } = require('../../middleware/dev-admin.middleware');
const { allowGuest } = require('../../middleware/auth.middleware');

const upload = multer({ dest: os.tmpdir() });

// Admin uploads
router.post('/upload/video', devAdmin('Dramas'), upload.single('video'), ctrl.uploadVideo);
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

module.exports = router;
