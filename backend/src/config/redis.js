const Redis = require('ioredis');
const config = require('./index');

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err.message));

module.exports = redis;
