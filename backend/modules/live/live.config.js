/**
 * Live streaming URL helpers (MediaMTX + nginx proxy).
 */

function hostPort(host, port, defaultPort) {
  const h = host || 'localhost';
  const p = port || defaultPort;
  return `${h}:${p}`;
}

export function getRtmpIngestUrl() {
  const host = process.env.MEDIAMTX_RTMP_HOST || 'localhost';
  const port = process.env.MEDIAMTX_RTMP_PORT || '1935';
  return `rtmp://${hostPort(host, port, '1935')}/live`;
}

export function getWhipPublishUrl(streamKey) {
  const base = process.env.LIVE_PUBLIC_BASE_URL || 'http://localhost:8080';
  const whipHost = process.env.MEDIAMTX_WHIP_HOST || process.env.LOCAL_IP || 'localhost';
  const whipPort = process.env.MEDIAMTX_WHIP_PORT || '8889';
  const scheme = base.startsWith('https') ? 'https' : 'http';
  return `${scheme}://${hostPort(whipHost, whipPort, '8889')}/live/${streamKey}/whip`;
}

/** Viewer HLS URL via nginx (Part 3). */
export function getViewerHlsUrl(streamKey) {
  const base = (
    process.env.LIVE_PUBLIC_BASE_URL ||
    process.env.CF_ORIGIN ||
    process.env.SERVER_ORIGIN ||
    'http://localhost:8080'
  ).replace(/\/$/, '');
  return `${base}/live/hls/live/${streamKey}/index.m3u8`;
}

export function parseStreamKeyFromPath(path) {
  if (!path || typeof path !== 'string') return null;
  const normalized = path.replace(/^\/+/, '');
  const match = normalized.match(/^live\/([^/]+)/);
  return match ? match[1] : null;
}

export function mapProtocolToSource(protocol) {
  const p = String(protocol || '').toLowerCase();
  if (p.includes('webrtc') || p.includes('whip')) return 'WHIP';
  if (p.includes('rtmp')) return 'RTMP';
  return p ? p.toUpperCase() : null;
}

export function extractYoutubeVideoId(urlOrId) {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
  return match ? match[1] : null;
}
