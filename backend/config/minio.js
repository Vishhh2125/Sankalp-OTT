import { Client as Minio } from 'minio';
import config from './index.js';

// Internal client for server-to-server communication with MinIO
const minioClient = new Minio({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: false,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

// Public client for generating presigned URLs with public host
const publicHost = process.env.MINIO_PUBLIC_HOST || `http://${config.minio.endPoint}:${config.minio.port}`;
const publicUrl = new URL(publicHost);

const minioPublicClient = new Minio({
  endPoint: publicUrl.hostname,
  port: parseInt(publicUrl.port) || 9000,
  useSSL: publicUrl.protocol === 'https:',
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export { minioClient, minioPublicClient };
export default minioClient;
