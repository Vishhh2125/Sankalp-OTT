import * as service from './live.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

async function createStream(req, res, next) {
  try {
    const data = await service.createStream(req.body, req.admin.id);
    return res.status(201).json(new ApiResponse(201, data, 'Live stream created'));
  } catch (e) {
    next(e);
  }
}

async function listStreams(req, res, next) {
  try {
    const streams = await service.listStreams();
    return res.json(new ApiResponse(200, streams, 'Streams fetched'));
  } catch (e) {
    next(e);
  }
}

async function getStream(req, res, next) {
  try {
    const stream = await service.getStreamById(req.params.id);
    return res.json(new ApiResponse(200, stream, 'Stream fetched'));
  } catch (e) {
    next(e);
  }
}

async function getActiveStreams(req, res, next) {
  try {
    const streams = await service.getActiveStreams();
    return res.json(new ApiResponse(200, streams, 'Active streams fetched'));
  } catch (e) {
    next(e);
  }
}

async function getPlayUrl(req, res, next) {
  try {
    const data = await service.getPlayUrl(req.params.id);
    return res.json(new ApiResponse(200, data, 'Playback URL'));
  } catch (e) {
    next(e);
  }
}

async function forceEndStream(req, res, next) {
  try {
    const stream = await service.forceEndStream(req.params.id);
    return res.json(new ApiResponse(200, stream, 'Stream ended'));
  } catch (e) {
    next(e);
  }
}

/** MediaMTX expects 20x = allowed, non-20x = denied */
async function authHook(req, res, next) {
  try {
    const result = await service.handleAuthHook(req.body);
    if (result.allowed) {
      return res.status(200).send('OK');
    }
    return res.status(403).send('Forbidden');
  } catch (e) {
    next(e);
  }
}

async function webhookOnLive(req, res, next) {
  try {
    const result = await service.handleOnLive(req.body);
    return res.json(new ApiResponse(200, result, 'Stream marked live'));
  } catch (e) {
    next(e);
  }
}

async function webhookOnEnded(req, res, next) {
  try {
    const result = await service.handleOnEnded(req.body);
    return res.json(new ApiResponse(200, result, 'Stream marked ended'));
  } catch (e) {
    next(e);
  }
}

// ── Viewer Tracking ──

async function joinStream(req, res, next) {
  try {
    const data = await service.joinStream(req.params.id, req.user?.id || null);
    return res.json(new ApiResponse(200, data, 'Joined stream'));
  } catch (e) {
    next(e);
  }
}

async function leaveStream(req, res, next) {
  try {
    const data = await service.leaveStream(req.params.sessionId);
    return res.json(new ApiResponse(200, data, 'Left stream'));
  } catch (e) {
    next(e);
  }
}

async function getViewers(req, res, next) {
  try {
    const data = await service.getViewers(req.params.id);
    return res.json(new ApiResponse(200, data, 'Viewers fetched'));
  } catch (e) {
    next(e);
  }
}

async function goLive(req, res, next) {
  try {
    const data = await service.markStreamLive(req.params.id, req.admin.id);
    return res.json(new ApiResponse(200, data, 'Stream is now live'));
  } catch (e) {
    next(e);
  }
}

export {
  createStream,
  listStreams,
  getStream,
  getActiveStreams,
  getPlayUrl,
  forceEndStream,
  authHook,
  webhookOnLive,
  webhookOnEnded,
  joinStream,
  leaveStream,
  getViewers,
  goLive,
};
