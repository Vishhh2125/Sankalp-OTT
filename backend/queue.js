import { Queue } from 'bullmq';
import redis from './config/redis.js';

const transcodeQueue = new Queue('transcode-queue', {
  connection: redis,
});

export default transcodeQueue;