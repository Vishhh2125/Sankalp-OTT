import minioClient from './minio.js';
import config from './index.js';

async function setupMinioBuckets() {
  const bucket = config.minio.bucket;

  try {
    const exists = await minioClient.bucketExists(bucket);
    if (exists) {
      console.log(`MinIO bucket "${bucket}" already exists`);
    } else {
      await minioClient.makeBucket(bucket);
      console.log(`MinIO bucket "${bucket}" created`);
    }

    // Public read access for thumbnails, banners (inside dramas/ folder)
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [
            `arn:aws:s3:::${bucket}/dramas/*/thumbnail.jpg`,
            `arn:aws:s3:::${bucket}/dramas/*/banner.jpg`,
          ],
        },
      ],
    };

    await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
    console.log('MinIO bucket policy set (public read for thumbnails/banners)');

    console.log('\nMinIO setup complete!');
    console.log(`  Console: http://localhost:9001 (minioadmin / minioadmin123)`);
    console.log(`  Bucket: ${bucket}`);
  } catch (err) {
    console.error('MinIO setup failed:', err.message);
    process.exit(1);
  }
}

setupMinioBuckets();
