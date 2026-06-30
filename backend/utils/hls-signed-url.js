import crypto from 'crypto';
import config from '../config/index.js';

function toSecureLinkDigest(value) {
  return crypto
    .createHash('md5')
    .update(value)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getHlsEpisodePrefix(objectName) {
  const normalizedObjectName = String(objectName || '').replace(/^\/+/, '');
  const match = normalizedObjectName.match(/^(dramas\/[^/]+\/episodes\/[^/]+)\//);
  return match ? match[1] : null;
}

function getSignedHlsPath(objectName, expirySeconds = config.hls.signedUrlTtl) {
  if (!objectName) return null;

  const normalizedObjectName = String(objectName).replace(/^\/+/, '');
  const episodePrefix = getHlsEpisodePrefix(normalizedObjectName);
  if (!episodePrefix) return null;

  // ✅ Round NOW down to the nearest window so all users in that
  // window get the same token → same Cloudflare cache key → HIT
  const windowSeconds = expirySeconds;           // e.g. 7200 = 2-hour window
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expires = windowStart + windowSeconds;   // token valid until end of window

  const signatureBase = `${expires}/${episodePrefix} ${config.hls.signingSecret}`;
  const signature = toSecureLinkDigest(signatureBase);

  return `/hls/${expires}/${signature}/${normalizedObjectName}`;
}

function getSignedEpisodeHlsPath(episode, expirySeconds) {
  if (!episode || episode.status !== 'ready' || !episode.hls_master_url) {
    return null;
  }

  return getSignedHlsPath(episode.hls_master_url, expirySeconds);
}

function getSignedDownloadUrl(episodeId, expirySeconds = config.hls.signedUrlTtl) {
  if (!episodeId) return null;

  const windowSeconds = expirySeconds;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expires = windowStart + windowSeconds;

  const signatureBase = `${expires}/raw/${episodeId} ${config.hls.signingSecret}`;
  const signature = toSecureLinkDigest(signatureBase);

  return `/hls/${expires}/${signature}/raw/${episodeId}/video.mp4`;
}

export { getSignedHlsPath, getSignedEpisodeHlsPath, getSignedDownloadUrl };
