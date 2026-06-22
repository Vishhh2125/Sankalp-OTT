import { randomBytes } from 'crypto';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../middleware/error.middleware.js';
import {
  getRtmpIngestUrl,
  getWhipPublishUrl,
  getViewerHlsUrl,
  parseStreamKeyFromPath,
  mapProtocolToSource,
} from './live.config.js';

function generateStreamKey() {
  return randomBytes(16).toString('hex');
}

function formatStream(stream, includeIngest = false) {
  const base = {
    id: stream.id,
    title: stream.title,
    thumbnail_url: stream.thumbnail_url,
    stream_key: stream.stream_key,
    status: stream.status,
    source_protocol: stream.source_protocol,
    created_by: stream.created_by,
    scheduled_at: stream.scheduled_at,
    started_at: stream.started_at,
    ended_at: stream.ended_at,
    created_at: stream.created_at,
    creator: stream.creator
      ? { id: stream.creator.id, name: stream.creator.name }
      : undefined,
  };
  if (includeIngest) {
    return {
      ...base,
      rtmp_url: getRtmpIngestUrl(),
      whip_url: getWhipPublishUrl(stream.stream_key),
    };
  }
  return base;
}

export async function createStream(data, adminId) {
  const { title, thumbnail_url, scheduled_at } = data;

  const streamKey = generateStreamKey();

  const stream = await prisma.liveStream.create({
    data: {
      title: title.trim(),
      thumbnail_url: thumbnail_url || null,
      stream_key: streamKey,
      status: 'SCHEDULED',
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

export async function listStreams() {
  const streams = await prisma.liveStream.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: { creator: { select: { id: true, name: true } } },
  });
  return streams.map((s) => formatStream(s, true));
}

export async function getStreamById(id) {
  const stream = await prisma.liveStream.findUnique({
    where: { id },
    include: { creator: { select: { id: true, name: true } } },
  });
  if (!stream) throw new AppError('Stream not found', 404);
  return formatStream(stream, true);
}

export async function getActiveStreams() {
  const streams = await prisma.liveStream.findMany({
    where: { status: 'LIVE' },
    orderBy: { started_at: 'desc' },
    include: { creator: { select: { id: true, name: true } } },
  });
  return streams.map((s) => ({
    ...formatStream(s),
    is_live: true,
  }));
}

export async function getPlayUrl(streamId) {
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
  if (!stream) throw new AppError('Stream not found', 404);
  if (stream.status !== 'LIVE') {
    throw new AppError('Stream is not live', 404);
  }

  return {
    stream_id: stream.id,
    title: stream.title,
    hls_url: getViewerHlsUrl(stream.stream_key),
    status: stream.status,
  };
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

/**
 * MediaMTX HTTP auth hook — allow publish only for valid, non-ended stream keys.
 * Read/playback on live/* is allowed for v1 (free access).
 */
export async function handleAuthHook(payload) {
  const { action, path } = payload;
  const streamKey = parseStreamKeyFromPath(path);

  if (!streamKey) {
    return { allowed: false };
  }

  const readActions = ['read', 'playback'];
  if (readActions.includes(action)) {
    return { allowed: true };
  }

  if (action !== 'publish') {
    return { allowed: false };
  }

  const stream = await prisma.liveStream.findUnique({
    where: { stream_key: streamKey },
    select: { status: true },
  });

  if (!stream || stream.status === 'ENDED') {
    return { allowed: false };
  }

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
