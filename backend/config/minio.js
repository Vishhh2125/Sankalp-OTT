import { Client as Minio } from 'minio';
import config from './index.js';

const minioClient = new Minio({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: false,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export default minioClient;
