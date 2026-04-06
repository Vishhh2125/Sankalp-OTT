const queue = require('./queue');

const PROFILES = ['360p', '480p', '720p', '1080p'];

async function createTranscodeJobs(episodeId, objectName) {
  for (const profile of PROFILES) {
    await queue.add('transcode', {
      episodeId,
      objectName,
      profile,
    });
  }
}

module.exports = { createTranscodeJobs };