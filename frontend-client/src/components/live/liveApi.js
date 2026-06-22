import { api } from '../../services/api';

export async function fetchActiveLiveStreams() {
  const res = await api.get('/live/active');
  return res.data?.data ?? [];
}

export async function fetchLivePlayUrl(streamId) {
  const res = await api.get(`/live/${streamId}/play`);
  return res.data?.data;
}
