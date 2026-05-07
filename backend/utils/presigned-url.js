import { minioPublicClient } from '../config/minio.js';
import config from '../config/index.js';

// Presigned PUT URL — browser uploads directly to MinIO using this
async function getPresignedPutUrl(objectName, expirySeconds = 900) {
  return minioPublicClient.presignedPutObject(config.minio.bucket, objectName, expirySeconds);
}

// Presigned GET URL — browser streams/views protected files using this
async function getPresignedGetUrl(objectName, expirySeconds = 7200) {
  return minioPublicClient.presignedGetObject(config.minio.bucket, objectName, expirySeconds);
}

// Public URL — for thumbnails/banners (open bucket policy, no auth needed)
function getPublicUrl(objectName) {
  const publicHost = process.env.MINIO_PUBLIC_HOST || `http://localhost:9000`;
  return `${publicHost}/${config.minio.bucket}/${objectName}`;
}

export { getPresignedPutUrl, getPresignedGetUrl, getPublicUrl };