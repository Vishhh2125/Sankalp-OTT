import { StyleSheet } from 'react-native';

import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants';
import { shortVideoTheme } from './theme';

export const styles = StyleSheet.create({
  reelContainer: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  uiOverlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16 },

  sideActionsColumn: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
    gap: 22,
    paddingRight: 4,
  },
  sideAction: { alignItems: 'center' },
  playPauseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  playIconNudge: { marginLeft: 1 },
  sideLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  textContent: { width: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  reelTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginRight: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },

  epBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  epBadgeText: {
    color: shortVideoTheme.crimson,
    fontSize: 12,
    fontWeight: '700',
  },

  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  descText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    paddingRight: 50,
  },

  progressContainer: { marginBottom: 12 },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: shortVideoTheme.crimson,
    borderRadius: 2,
  },
  scrubberDot: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: shortVideoTheme.crimson,
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },

  episodeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  episodeText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  watchAllText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  topSearch: { position: 'absolute', right: 20, padding: 10 },

  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  lockIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,45,85,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  lockButton: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
  },
  lockButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
