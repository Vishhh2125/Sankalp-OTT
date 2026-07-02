import { randomBytes } from 'crypto';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../middleware/error.middleware.js';
import {
  getRtmpIngestUrl,
  getWhipPublishUrl,
  getViewerHlsUrl,
  parseStreamKeyFromPath,
  mapProtocolToSource,
  extractYoutubeVideoId,
} from './live.config.js';

function generateStreamKey() {
  return randomBytes(16).toString('hex');
}

const MEDIAMTX_API_URL = (process.env.MEDIAMTX_API_URL || 'http://mediamtx:9997').replace(/\/$/, '');

function protocolFromMediaMtxPath(pathInfo) {
  const type = String(pathInfo?.source?.type || '').toLowerCase();
  if (type.includes('webrtc')) return 'WHIP';
  if (type.includes('rtmp')) return 'RTMP';
  return null;
}

async function getMediaMtxPathMap() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(`${MEDIAMTX_API_URL}/v3/paths/list`, {
      signal: controller.signal,
    });
    if (!res.ok) return new Map();

    const data = await res.json();
    return new Map((data.items || []).map((item) => [item.name, item]));
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeout);
  }
}

async function reconcileStreamWithMediaMtx(stream, pathMap = null) {
  if (!stream || stream.status === 'ENDED') return stream;
  if (stream.source_type !== 'MEDIAMTX') return stream;

  const paths = pathMap || await getMediaMtxPathMap();
  const pathInfo = paths.get(`live/${stream.stream_key}`);
  const isOnline = Boolean(pathInfo?.ready || pathInfo?.online || pathInfo?.available);

  if (isOnline && stream.status !== 'LIVE') {
    return prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        status: 'LIVE',
        started_at: stream.started_at || new Date(pathInfo.readyTime || pathInfo.onlineTime || Date.now()),
        source_protocol: protocolFromMediaMtxPath(pathInfo) || stream.source_protocol,
        ended_at: null,
      },
      include: { creator: { select: { id: true, name: true } } },
    });
  }

  if (isOnline) {
    const sourceProtocol = protocolFromMediaMtxPath(pathInfo);
    if (sourceProtocol && stream.source_protocol !== sourceProtocol) {
      return prisma.liveStream.update({
        where: { id: stream.id },
        data: { source_protocol: sourceProtocol },
        include: { creator: { select: { id: true, name: true } } },
      });
    }
  }

  return stream;
}

function formatStream(stream, includeIngest = false) {
  const base = {
    id: stream.id,
    title: stream.title,
    thumbnail_url: stream.thumbnail_url,
    stream_key: stream.stream_key,
    status: stream.status,
    source_protocol: stream.source_protocol,
    source_type: stream.source_type,
    youtube_video_id: stream.youtube_video_id,
    created_by: stream.created_by,
    scheduled_at: stream.scheduled_at,
    started_at: stream.started_at,
    ended_at: stream.ended_at,
    created_at: stream.created_at,
    creator: stream.creator
      ? { id: stream.creator.id, name: stream.creator.name }
      : undefined,
  };
  if (includeIngest && stream.source_type === 'MEDIAMTX') {
    return {
      ...base,
      rtmp_url: getRtmpIngestUrl(),
      whip_url: getWhipPublishUrl(stream.stream_key),
    };
  }
  return base;
}

export async function createStream(data, adminId) {
  const { title, thumbnail_url, scheduled_at, source_type = 'YOUTUBE', youtube_video_id } = data;

  const streamKey = generateStreamKey();

  if (source_type === 'YOUTUBE') {
    const youtubeId = extractYoutubeVideoId(youtube_video_id);
    if (!youtubeId) {
      throw new AppError('Invalid YouTube video ID or URL', 400);
    }

    const stream = await prisma.liveStream.create({
      data: {
        title: title.trim(),
        thumbnail_url: thumbnail_url || null,
        stream_key: streamKey,
        status: 'SCHEDULED',
        source_type: 'YOUTUBE',
        youtube_video_id: youtubeId,
        created_by: adminId,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      },
      include: { creator: { select: { id: true, name: true } } },
    });

    return {
      stream: formatStream(stream, false),
      stream_id: stream.id,
    };
  } else {
    // LEGACY: MediaMTX path — retained for fallback
    const stream = await prisma.liveStream.create({
      data: {
        title: title.trim(),
        thumbnail_url: thumbnail_url || null,
        stream_key: streamKey,
        status: 'SCHEDULED',
        source_type: 'MEDIAMTX',
        created_by: adminId,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      },
      include: { creator: { select: { id: true, name: true } } },
    });

    return {
      stream: formatStream(stream, true),
      stream_id: stream.id,
      stream_key: streamKey,
      rtmp_url: getRtmpIngestUrl(),
      whip_url: getWhipPublishUrl(streamKey),
    };
  }
}

export async function listStreams() {
  const streams = await prisma.liveStream.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: { creator: { select: { id: true, name: true } } },
  });
  const pathMap = await getMediaMtxPathMap();
  const reconciled = await Promise.all(streams.map((s) => reconcileStreamWithMediaMtx(s, pathMap)));
  return reconciled.map((s) => formatStream(s, true));
}

export async function getStreamById(id) {
  const stream = await prisma.liveStream.findUnique({
    where: { id },
    include: { creator: { select: { id: true, name: true } } },
  });
  if (!stream) throw new AppError('Stream not found', 404);
  const reconciled = await reconcileStreamWithMediaMtx(stream);
  return formatStream(reconciled, true);
}

export async function getActiveStreams() {
  const candidates = await prisma.liveStream.findMany({
    where: { status: { in: ['SCHEDULED', 'LIVE'] } },
    orderBy: { started_at: 'desc' },
    include: { creator: { select: { id: true, name: true } } },
  });
  const pathMap = await getMediaMtxPathMap();
  const streams = await Promise.all(candidates.map((s) => reconcileStreamWithMediaMtx(s, pathMap)));
  return streams.filter((s) => s.status === 'LIVE').map((s) => ({
    ...formatStream(s),
    is_live: true,
  }));
}

export async function getPlayUrl(streamId) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    include: { creator: { select: { id: true, name: true } } },
  });
  if (!stream) throw new AppError('Stream not found', 404);
  const reconciled = await reconcileStreamWithMediaMtx(stream);
  if (reconciled.status !== 'LIVE') {
    throw new AppError('Stream is not live', 404);
  }

  if (reconciled.source_type === 'YOUTUBE') {
    return {
      stream_id: reconciled.id,
      title: reconciled.title,
      video_source: 'YOUTUBE',
      youtube_video_id: reconciled.youtube_video_id,
      status: reconciled.status,
    };
  }

  return {
    stream_id: reconciled.id,
    title: reconciled.title,
    hls_url: getViewerHlsUrl(reconciled.stream_key),
    status: reconciled.status,
  };
}

export async function markStreamLive(streamId, adminId) {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    include: { creator: { select: { id: true, name: true } } },
  });
  if (!stream) throw new AppError('Stream not found', 404);
  if (stream.source_type !== 'YOUTUBE') {
    throw new AppError('Only valid for YouTube live streams', 400);
  }
  if (stream.status !== 'SCHEDULED') {
    throw new AppError('Stream is not in SCHEDULED status', 400);
  }

  const updated = await prisma.liveStream.update({
    where: { id: streamId },
    data: {
      status: 'LIVE',
      started_at: new Date(),
    },
    include: { creator: { select: { id: true, name: true } } },
  });

  return formatStream(updated);
}

export async function forceEndStream(streamId) {
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
  if (!stream) throw new AppError('Stream not found', 404);

  const now = new Date();
  const updated = await prisma.liveStream.update({
    where: { id: streamId },
    data: {
      status: 'ENDED',
      ended_at: stream.ended_at || now,
    },
    include: { creator: { select: { id: true, name: true } } },
  });

  return formatStream(updated);
}

// LEGACY: MediaMTX webhook handlers — unused for YOUTUBE source_type streams, retained for fallback.
/**
 * MediaMTX HTTP auth hook — allow publish only for valid, non-ended stream keys.
 * Read/playback on live/* is allowed for v1 (free access).
 */
export async function handleAuthHook(payload) {
  const { action, path } = payload;
  const streamKey = parseStreamKeyFromPath(path);

  console.log(`[MediaMTX AuthHook] action: "${action}", path: "${path}", streamKey: "${streamKey}"`);

  if (!streamKey) {
    console.warn(`[MediaMTX AuthHook] DENIED: unable to parse streamKey from path "${path}"`);
    return { allowed: false };
  }

  const readActions = ['read', 'playback'];
  if (readActions.includes(action)) {
    console.log(`[MediaMTX AuthHook] ALLOWED: action is "${action}"`);
    return { allowed: true };
  }

  if (action !== 'publish') {
    console.warn(`[MediaMTX AuthHook] DENIED: invalid action "${action}" for stream key`);
    return { allowed: false };
  }

  const stream = await prisma.liveStream.findUnique({
    where: { stream_key: streamKey },
    select: { status: true },
  });

  if (!stream || stream.status === 'ENDED') {
    console.warn(`[MediaMTX AuthHook] DENIED: stream "${streamKey}" status is ${stream ? stream.status : 'NOT_FOUND'}`);
    return { allowed: false };
  }

  console.log(`[MediaMTX AuthHook] ALLOWED: publish for stream "${streamKey}"`);
  return { allowed: true };
}

export async function handleOnLive(payload) {
  const streamKey = parseStreamKeyFromPath(payload.path);
  if (!streamKey) return { ok: false, reason: 'invalid_path' };

  const sourceProtocol =
    mapProtocolToSource(payload.protocol) ||
    mapProtocolToSource(payload.source_type);

  const stream = await prisma.liveStream.findUnique({
    where: { stream_key: streamKey },
  });
  if (!stream || stream.status === 'ENDED') {
    return { ok: false, reason: 'stream_not_found_or_ended' };
  }

  const now = new Date();
  await prisma.liveStream.update({
    where: { id: stream.id },
    data: {
      status: 'LIVE',
      started_at: stream.started_at || now,
      source_protocol: sourceProtocol || stream.source_protocol,
    },
  });

  return { ok: true, stream_id: stream.id };
}

export async function handleOnEnded(payload) {
  const streamKey = parseStreamKeyFromPath(payload.path);
  if (!streamKey) return { ok: false, reason: 'invalid_path' };

  const stream = await prisma.liveStream.findUnique({
    where: { stream_key: streamKey },
  });
  if (!stream) return { ok: false, reason: 'stream_not_found' };

  if (stream.status === 'ENDED') {
    return { ok: true, stream_id: stream.id, already_ended: true };
  }

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: {
      status: 'ENDED',
      ended_at: new Date(),
    },
  });

  return { ok: true, stream_id: stream.id };
}

// ──────────────────────────────────────
// VIEWER TRACKING
// ──────────────────────────────────────

export async function joinStream(streamId, userId) {
  // Validate stream exists
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
  if (!stream) throw new AppError('Stream not found', 404);

  // If authenticated user, check for existing active session
  if (userId) {
    const existing = await prisma.liveViewerSession.findFirst({
      where: {
        stream_id: streamId,
        user_id: userId,
        is_active: true,
      },
    });
    if (existing) {
      return { session_id: existing.id, already_joined: true };
    }
  }

  // Create new session
  const session = await prisma.liveViewerSession.create({
    data: {
      stream_id: streamId,
      user_id: userId || null,
      guest_name: userId ? null : 'Guest',
    },
  });

  return { session_id: session.id, already_joined: false };
}

export async function leaveStream(sessionId) {
  const session = await prisma.liveViewerSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.is_active) {
    return { ok: true, already_left: true };
  }

  await prisma.liveViewerSession.update({
    where: { id: sessionId },
    data: {
      is_active: false,
      left_at: new Date(),
    },
  });

  return { ok: true };
}

export async function getViewers(streamId) {
  const sessions = await prisma.liveViewerSession.findMany({
    where: {
      stream_id: streamId,
      is_active: true,
    },
    orderBy: { joined_at: 'asc' },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  const viewers = sessions.map((s) => ({
    session_id: s.id,
    user_id: s.user_id,
    name: s.user?.name || s.guest_name || 'Guest',
    avatar_url: null,
    joined_at: s.joined_at,
  }));

  return {
    viewer_count: viewers.length,
    viewers,
  };
}
