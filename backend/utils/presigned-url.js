import minioClient from '../config/minio.js';
import config from '../config/index.js';

// Generate a presigned PUT URL (for uploading files from browser/admin)
async function getPresignedPutUrl(objectName, expirySeconds = 900) {
  return minioClient.presignedPutObject(config.minio.bucket, objectName, expirySeconds);
}

// Generate a presigned GET URL (for viewing/streaming protected files)
async function getPresignedGetUrl(objectName, expirySeconds = 7200) {
  return minioClient.presignedGetObject(config.minio.bucket, objectName, expirySeconds);
}

// Get a public URL (for thumbnails/banners that don't need auth)
function getPublicUrl(objectName) {
  const protocol = config.minio.useSSL ? 'https' : 'http';
  return `${protocol}://${config.minio.endPoint}:${config.minio.port}/${config.minio.bucket}/${objectName}`;
}

export { getPresignedPutUrl, getPresignedGetUrl, getPublicUrl };
