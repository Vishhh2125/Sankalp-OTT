import { api } from '../../services/api';

export async function fetchActiveLiveStreams() {
  const res = await api.get('/live/active');
  return res.data?.data ?? [];
}

export async function fetchLivePlayUrl(streamId) {
  const res = await api.get(`/live/${streamId}/play`);
  return res.data?.data;
}

export async function joinStream(streamId) {
  const res = await api.post(`/live/${streamId}/join`);
  return res.data?.data;
}

export async function leaveStream(sessionId) {
  const res = await api.post(`/live/session/${sessionId}/leave`);
  return res.data?.data;
}
