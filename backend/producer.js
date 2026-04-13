import { Queue } from 'bullmq';
import redis from './config/redis.js';

const transcodeQueue = new Queue('transcode-queue', { connection: redis });

const PROFILES = ['360p', '480p', '720p', '1080p'];

async function createTranscodeJobs(episodeId, objectName, showId) {
  const jobs = PROFILES.map(profile => ({
    name: `transcode-${profile}`,
    data: {
      episodeId,
      objectName,
      showId,
      profile,
    },
    opts: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 50,
      removeOnFail: 20,
    },
  }));

  const added = await transcodeQueue.addBulk(jobs);
  console.log(`[Producer] ${added.length} transcode jobs enqueued for episode ${episodeId}:`, PROFILES.join(', '));
  return added;
}

export { createTranscodeJobs };
