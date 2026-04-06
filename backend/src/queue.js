const { Queue } = require('bullmq');
const redis = require('./config/redis');

const transcodeQueue = new Queue('transcode-queue', {
  connection: redis,
});

module.exports = transcodeQueue;