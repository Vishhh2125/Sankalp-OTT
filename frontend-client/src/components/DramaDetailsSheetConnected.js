import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Svg, { Circle } from 'react-native-svg';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatCount } from './shortVideoPlayer/utils';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../constants/config';
import { courseworkApi } from '../services/courseworkApi';
import { downloadFile } from '../utils/fileDownloader';
import AssignmentsTab from './coursework/AssignmentsTab';
import MaterialsTab from './coursework/MaterialsTab';
import QuizTab from './coursework/QuizTab';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { unlockShow } from '../redux/slices/showPlayerSlice';
import { ROUTES } from '../constants/routes';

// Debug log for thumbnails
const debugThumbnail = (source, details_tn, item_tn, details_id, item_id) => {
  console.log('[DramaDetailsSheet-thumbnail]', {
    posterSource: source,
    detailsThumbnailUrl: details_tn,
    itemThumbnailUrl: item_tn,
    detailsShowId: details_id,
    itemShowId: item_id,
  });
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.9);
const EPISODE_GAP = 6;
const EPISODES_PER_PAGE = 30;
const SHEET_HORIZONTAL_PADDING = 16;
const RELATED_GAP = 8;
const RELATED_CARD_WIDTH = '31%';
const RELATED_LIMIT = 6;

function resolveThumbnailUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('file://')) {
    if (url.includes('/ott-media/')) return `${API_BASE_URL}${url.substring(url.indexOf('/ott-media/'))}`;
    if (url.includes('/uploads/')) return `${API_BASE_URL}${url.substring(url.indexOf('/uploads/'))}`;
    return url;
  }
  const separator = url.startsWith('/') ? '' : '/';
  return `${API_BASE_URL}${separator}${url}`;
}

function Tag({ label }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function TeacherProfileCard({ profile }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [expanded, setExpanded] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  if (!profile) return null;

  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.timing(animation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const bodyHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240],
  });

  const arrowRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.teacherCardRoot}>
      <Text style={styles.teacherCardTitle}>About Teacher</Text>

      <Pressable style={styles.teacherCardHeader} onPress={toggleExpand}>
        {profile.profile_photo_url ? (
          <Image
            source={{ uri: resolveThumbnailUrl(profile.profile_photo_url) }}
            style={styles.teacherAvatar}
          />
        ) : (
          <View style={styles.teacherAvatarPlaceholder}>
            <Ionicons
              name="person"
              size={24}
              color={theme.textMuted}
            />
          </View>
        )}

        <View style={styles.teacherCardHeaderRight}>
          <View style={styles.teacherNameRow}>
            <Text style={styles.teacherName}>
              {profile.full_name}
            </Text>

            <Animated.View
              style={{
                transform: [{ rotate: arrowRotation }],
              }}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={theme.textMuted}
              />
            </Animated.View>
          </View>

          <Text
            style={styles.teacherHeadline}
            numberOfLines={2}
          >
            {profile.professional_headline}
          </Text>
        </View>
      </Pressable>

      <Animated.View
        style={[
          styles.teacherCardBody,
          {
            height: bodyHeight,
            overflow: 'hidden',
          },
        ]}
      >
        <ScrollView
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: 16,
            paddingRight: 4,
          }}
        >
          <Text style={styles.teacherBioTitle}>Bio</Text>

          <Text style={styles.teacherBioText}>
            {profile.bio || 'N/A'}
          </Text>

          {profile.experience_years != null && (
            <View style={styles.teacherInfoRow}>
              <Text style={styles.teacherInfoLabel}>
                Years of experience:
              </Text>
              <Text style={styles.teacherInfoValue}>
                {profile.experience_years}
              </Text>
            </View>
          )}

          {Boolean(profile.qualification) && (
            <View style={styles.teacherInfoRow}>
              <Text style={styles.teacherInfoLabel}>
                Qualification:
              </Text>
              <Text style={styles.teacherInfoValue}>
                {profile.qualification}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function getRangeStart(episodeNum = 1) {
  return Math.floor((Math.max(episodeNum, 1) - 1) / EPISODES_PER_PAGE) * EPISODES_PER_PAGE + 1;
}

function buildRanges(totalEpisodes) {
  const ranges = [];
  const safeTotal = Math.max(totalEpisodes || 0, 0);

  for (let start = 1; start <= safeTotal; start += EPISODES_PER_PAGE) {
    const end = Math.min(start + EPISODES_PER_PAGE - 1, safeTotal);
    ranges.push({
      key: `${start}-${end}`,
      start,
      label: `${start}-${end}`,
    });
  }

  return ranges;
}

function RelatedDramaCard({ drama, onPress, style }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const uri = resolveThumbnailUrl(drama.thumbnail_url);

  return (
    <Pressable
      style={[styles.relatedCard, style]}
      onPress={onPress}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.relatedPoster}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.relatedPoster, styles.posterFallback]} />
      )}

      <Text
        style={styles.relatedTitle}
        numberOfLines={2}
      >
        {drama.title}
      </Text>
    </Pressable>
  );
}

export function TrophyProgressRing({ completedCount = 0, totalEpisodes = 1, showText = true, size = 26 }) {
  const { theme } = useTheme();
  const ringStyles = useRingStyles(theme);

  const total = totalEpisodes > 0 ? totalEpisodes : 1;
  const pct = Math.min(Math.round((completedCount / total) * 100), 100);
  const isAllDone = pct === 100;

  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const activeColor = isAllDone ? theme.primary : '#A855F7';

  return (
    <View style={ringStyles.container}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {pct > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={activeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>
        <Ionicons
          name="trophy"
          size={size * 0.48}
          color={activeColor}
        />
      </View>
      {showText && <Text style={ringStyles.pctText}>{pct}%</Text>}
    </View>
  );
}

const useRingStyles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  pctText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '700',
  },
});

function EpisodeRow({ episode, isCurrentEpisode, onPress }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  if (!episode) return null;

  const locked = episode.is_locked;
  const isReady = episode.status === 'ready';
  const isCompleted = Boolean(episode.is_completed) && !locked;
  const progressSec = locked ? 0 : (episode.progress_sec || 0);
  const durationSec = episode.duration_sec || 0;
  const isInProgress = !isCompleted && !locked && progressSec > 0;

  let iconName = 'play';
  if (locked) {
    iconName = 'lock-closed';
  } else if (isCompleted) {
    iconName = 'checkmark-circle';
  } else if (!isInProgress && !isCurrentEpisode) {
    iconName = 'play-outline';
  }

  const iconCircleStyle = locked
    ? styles.episodeIconCircleLocked
    : (isCompleted || isInProgress || isCurrentEpisode)
      ? styles.episodeIconCircleActive
      : styles.episodeIconCircleUnstarted;

  const isTitleOrange = isCompleted;

  return (
    <Pressable
      style={[
        styles.episodeRow,
        !isReady && styles.episodeRowPending,
      ]}
      onPress={() => onPress && onPress(episode)}
      disabled={!onPress}
    >
      {/* Play / Checkmark / Lock icon circle */}
      <View style={[styles.episodeIconCircle, iconCircleStyle]}>
        <Ionicons
          name={iconName}
          size={isCompleted ? 18 : 16}
          color={locked ? (theme.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,26,0.5)') : '#fff'}
        />
      </View>

      {/* Text */}
      <View style={styles.episodeRowText}>
        <Text
          style={[
            styles.episodeRowTitle,
            isTitleOrange && styles.episodeRowTitleActive,
          ]}
          numberOfLines={1}
        >
          Lectures {episode.episode_num}
          {episode.title || episode.episode_title ? `  •  ${episode.title || episode.episode_title}` : ''}
        </Text>
        <Text style={styles.episodeRowMeta} numberOfLines={1}>
          Lec {episode.episode_num}
          {durationSec > 0 ? `  •  ${Math.round(durationSec / 60)} min` : ''}
          {isCompleted ? '  •  Completed' : isInProgress ? `  •  ${Math.round(progressSec / 60)}m watched` : ''}
        </Text>

        {/* In-progress mini progress bar */}
        {isInProgress && durationSec > 0 && (
          <View style={styles.inProgressTrack}>
            <View style={[styles.inProgressFill, { width: `${Math.min((progressSec / durationSec) * 100, 100)}%` }]} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function DramaDetailsSheetConnected({
  visible,
  item,
  details = null,
  loading = false,
  error = null,
  initialTab = 'synopsis',
  onClose,
  onRangeChange,
  onEpisodePress,
  onRelatedPress,
  onStartWatching,
}) {
  const { theme, isDarkMode } = useTheme();
  const styles = useStyles(theme);
  // All hooks must be called unconditionally, before any returns
  const resolvedInitialTab = initialTab === 'lectures' ? 'episodes' : initialTab;
  const [tab, setTab] = useState(resolvedInitialTab);
  const [activeRangeStart, setActiveRangeStart] = useState(1);
  const [relatedShows, setRelatedShows] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const scrollRef = useRef(null);

  // Coursework state
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsFetched, setAssignmentsFetched] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsFetched, setMaterialsFetched] = useState(false);
  const [materialsHasAccess, setMaterialsHasAccess] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [quizzesFetched, setQuizzesFetched] = useState(false);
  const [certStatus, setCertStatus] = useState(null);

  const handleAssignmentSubmitted = useCallback((assignmentId, submission) => {
    setAssignments((current) => current.map((assignment) => (
      assignment.id === assignmentId
        ? { ...assignment, submission }
        : assignment
    )));
  }, []);

  const handleQuizAttemptCompleted = useCallback((quizId, attempt) => {
    setQuizzes((current) => current.map((quiz) => (
      quiz.id === quizId
        ? { ...quiz, attempt }
        : quiz
    )));
  }, []);

  useEffect(() => {
    if (!visible || !item) return;

    setTab(resolvedInitialTab);
    setActiveRangeStart(getRangeStart(item.episode_num || 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // Reset coursework fetch flags when show changes
    setAssignmentsFetched(false);
    setMaterialsFetched(false);
    setQuizzesFetched(false);
    setCertStatus(null);

    // Fetch certificate status for show
    if (item.show_id) {
      courseworkApi.getCertificateStatus(item.show_id)
        .then(res => setCertStatus(res.data || null))
        .catch(() => setCertStatus(null));
    }
  }, [visible, initialTab, item]);

  // Fetch coursework data on tab switch
  useEffect(() => {
    if (!visible || !item?.show_id) return;
    const showId = item.show_id;

    if (tab === 'assignments' && !assignmentsFetched) {
      setAssignmentsLoading(true);
      courseworkApi.getAssignments(showId)
        .then(res => { setAssignments(res.data || []); setAssignmentsFetched(true); })
        .catch(() => setAssignments([]))
        .finally(() => setAssignmentsLoading(false));
    }

    if (tab === 'materials' && !materialsFetched) {
      setMaterialsLoading(true);
      courseworkApi.getMaterials(showId)
        .then(res => {
          const data = res.data || [];
          setMaterials(Array.isArray(data) ? data : data.items || []);
          setMaterialsHasAccess(true);
          setMaterialsFetched(true);
        })
        .catch((error) => {
          if (error?.response?.status === 403) {
            setMaterialsHasAccess(false);
          }
          setMaterials([]);
          setMaterialsFetched(true);
        })
        .finally(() => setMaterialsLoading(false));
    }

    if (tab === 'quizzes' && !quizzesFetched) {
      setQuizzesLoading(true);
      courseworkApi.getQuizzes(showId)
        .then(res => { setQuizzes(res.data || []); setQuizzesFetched(true); })
        .catch(() => setQuizzes([]))
        .finally(() => setQuizzesLoading(false));
    }
  }, [tab, visible, item?.show_id, assignmentsFetched, materialsFetched, quizzesFetched]);

  useEffect(() => {
    if (!visible || !item?.show_id) {
      setRelatedShows([]);
      return undefined;
    }

    let cancelled = false;
    const showId = item.show_id;

    async function loadRelated() {
      setRelatedLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/content/shows/${showId}/related?limit=${RELATED_LIMIT}`
        );
        const data = await res.json();
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setRelatedShows(items.slice(0, RELATED_LIMIT));
      } catch {
        if (!cancelled) setRelatedShows([]);
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    }

    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [visible, item?.show_id]);

  const showIsLocked = useMemo(() => {
    const showDetails = details?.show_id === item?.show_id ? details : null;
    return showDetails?.is_locked === true;
  }, [details, item]);

  // Reset coursework flags and data when the show lock status changes
  useEffect(() => {
    setAssignmentsFetched(false);
    setMaterialsFetched(false);
    setQuizzesFetched(false);
    setAssignments([]);
    setMaterials([]);
    setQuizzes([]);
  }, [showIsLocked]);

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const coins = useSelector((s) => s.auth?.coins) ?? 0;
  const [unlockingShow, setUnlockingShow] = useState(false);
  const [unlockError, setUnlockError] = useState(null);

  const handleBuyShow = useCallback(async () => {
    const showDetails = details?.show_id === item?.show_id ? details : null;
    if (!showDetails?.show_id || unlockingShow) return;
    setUnlockError(null);

    const cost = showDetails.show_coin_cost || 0;
    if (coins < cost) {
      setUnlockError('Not enough coins to purchase the show!');
      return;
    }

    setUnlockingShow(true);
    try {
      await dispatch(unlockShow(showDetails.show_id)).unwrap();
      if (onRangeChange) {
        onRangeChange(activeRangeStart);
      }
      alert('Show purchased successfully!');
    } catch (err) {
      setUnlockError(err?.message || 'Failed to purchase show');
    } finally {
      setUnlockingShow(false);
    }
  }, [dispatch, details, item, coins, activeRangeStart, onRangeChange, unlockingShow]);

  const goToTopUp = useCallback(() => {
    navigation.navigate(ROUTES.TOP_UP, {
      returnToShowPlayer: false,
    });
  }, [navigation]);

  // Move useMemo BEFORE the early return
  const posterSource = useMemo(() => {
    if (!item) return null;

    // Helper to resolve thumbnail URLs to absolute URLs
    const resolveThumbnailUrl = (url) => {
      if (!url) return null;
      if (url.startsWith('http')) return url; // already absolute
      const separator = url.startsWith('/') ? '' : '/';
      return `${API_BASE_URL}${separator}${url}`; // make it absolute
    };

    if (details?.show_id === item.show_id && details?.thumbnail_url) {
      const resolved = resolveThumbnailUrl(details.thumbnail_url);
      debugThumbnail({ uri: resolved }, details?.thumbnail_url, item?.thumbnail_url, details?.show_id, item?.show_id);
      return { uri: resolved };
    }
    if (item.thumbnail_url) {
      const resolved = resolveThumbnailUrl(item.thumbnail_url);
      debugThumbnail({ uri: resolved }, details?.thumbnail_url, item?.thumbnail_url, details?.show_id, item?.show_id);
      return { uri: resolved };
    }
    if (item.image) {
      debugThumbnail(item.image, details?.thumbnail_url, item?.thumbnail_url, details?.show_id, item?.show_id);
      return item.image;
    }
    debugThumbnail(null, details?.thumbnail_url, item?.thumbnail_url, details?.show_id, item?.show_id);
    return null;
  }, [details?.thumbnail_url, item?.thumbnail_url, item?.image, item?.show_id, details?.show_id]);

  // Now safe to return early if no item
  if (!item) return null;

  const showDetails = details?.show_id === item.show_id ? details : null;
  const showIsPaid = showDetails?.show_is_free === false;
  const title = showDetails?.show_title || item.show_title || item.title || 'Untitled drama';
  const synopsisText = showDetails?.synopsis || item.synopsis || 'Synopsis not available yet.';
  const tags = showDetails?.tags || item.tags || [];
  const totalEpisodes = showDetails?.total_episodes || item.total_episodes || item.episodeCount || 0;
  const ranges = buildRanges(totalEpisodes);
  const currentEpisode = item.episode_num || 1;
  const currentEpisodes = showDetails?.episodes || [];

  const viewCountValue = showDetails?.view_count ?? item.view_count ?? null;
  const viewsLabel = item.views
    ? `${item.views} Views`
    : viewCountValue !== null
      ? `${formatCount(viewCountValue)} Views`
      : null;

  const handleRangePress = (rangeStart) => {
    setActiveRangeStart(rangeStart);
    scrollRef.current?.scrollTo({ y: 0, animated: true });

    if (rangeStart !== activeRangeStart) {
      onRangeChange && onRangeChange(rangeStart);
    }
  };

  const handleRetry = () => {
    onRangeChange && onRangeChange(activeRangeStart);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {loading && !details ? (
            <View style={[styles.stateBlock, { height: SHEET_HEIGHT * 0.8 }]}>
              <ActivityIndicator size="large" color={theme.crimson} />
            </View>
          ) : (
            <>
              <View style={styles.topRow}>
                <View style={styles.posterRow}>
                  {posterSource ? (
                    <Image
                      source={posterSource}
                      style={styles.poster}
                      resizeMode="cover"
                      onLoad={() => console.log('[Image-onLoad] Poster loaded successfully')}
                      onError={(err) => console.log('[Image-onError] Failed to load poster:', err.error)}
                    />
                  ) : (
                    <View style={[styles.poster, styles.posterFallback]} />
                  )}
                  <View style={styles.posterMeta}>
                    <Text style={styles.title} numberOfLines={1}>
                      {title}
                    </Text>
                    {viewsLabel ? (
                      <Text style={styles.metaText}>{viewsLabel}</Text>
                    ) : null}
                  </View>
                </View>
                <Pressable onPress={onClose} hitSlop={15}>
                  <Ionicons name="close" size={26} color={theme.white} />
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabsRow}
              >
                {[
                  { key: 'synopsis', label: 'Intro' },
                  { key: 'episodes', label: 'Lectures' },
                  { key: 'assignments', label: 'Assignments' },
                  { key: 'materials', label: 'Materials' },
                  { key: 'quizzes', label: 'Quiz' },
                ].map(t => (
                  <Pressable
                    key={t.key}
                    onPress={() => { setTab(t.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                    style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
                  >
                    <Text
                      style={[styles.tabText, tab === t.key && styles.tabTextActive]}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                    {tab === t.key && <View style={styles.tabUnderline} />}
                  </Pressable>
                ))}
              </ScrollView>

              <ScrollView
                ref={scrollRef}
                style={styles.bodyScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
              >
                {/* Course Certificate Card */}
                {(certStatus?.rules?.certificate_enabled || certStatus?.config?.certificate_enabled) && (
                  <View style={styles.certCardRoot}>
                    {certStatus.is_issued ? (
                      <View style={styles.certIssuedRow}>
                        <View style={styles.certIconBadge}>
                          <Ionicons name="ribbon" size={24} color="#F59E0B" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.certCardTitle}>Course Certificate Earned! 🎉</Text>
                          <Text style={styles.certCardSubtitle}>
                            Code: {certStatus.certificate?.certificate_code}
                          </Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [styles.certDownloadBtn, pressed && styles.certDownloadBtnPressed]}
                          onPress={() => {
                            if (certStatus.certificate?.pdf_url) {
                              downloadFile(certStatus.certificate.pdf_url, `${title || 'Course'}_Certificate`, 'pdf');
                            }
                          }}
                        >
                          <Ionicons name="download-outline" size={14} color="#FFF" />
                          <Text style={styles.certDownloadBtnText}>PDF</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.certReqRow}>
                        <Ionicons name="ribbon-outline" size={20} color={theme.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.certReqTitle}>Official Completion Certificate</Text>
                          <Text style={styles.certReqSub}>
                            Complete required lectures, quizzes, and assignments to earn your certificate.
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {tab === 'synopsis' ? (
                  <View>
                    <Text style={styles.synopsis}>{synopsisText}</Text>
                    {tags.length > 0 ? (
                      <View style={styles.tagsRow}>
                        {tags.map((tag) => (
                          <Tag key={tag} label={tag} />
                        ))}
                      </View>
                    ) : null}

                    {showIsPaid && showIsLocked && (
                      <View style={styles.buyShowContainer}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.buyShowBtn,
                            pressed && styles.buyShowBtnPressed,
                            unlockingShow && styles.buyShowBtnDisabled,
                          ]}
                          onPress={handleBuyShow}
                          disabled={unlockingShow}
                        >
                          {unlockingShow ? (
                            <ActivityIndicator color={theme.white} size="small" />
                          ) : (
                            <>
                              <Ionicons name="cart" size={18} color={theme.white} />
                              <Text style={styles.buyShowText}>
                                Buy Full Course · {showDetails?.show_coin_cost} Coins
                              </Text>
                            </>
                          )}
                        </Pressable>
                        <Text style={styles.buyShowCoinsText}>Your balance: {coins} coins</Text>
                        {unlockError ? (
                          <Text style={styles.buyShowErrorText}>{unlockError}</Text>
                        ) : null}
                        {coins < (showDetails?.show_coin_cost || 0) && (
                          <Pressable onPress={goToTopUp} style={styles.getCoinsBtn}>
                            <Text style={styles.getCoinsText}>Get Coins</Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    <TeacherProfileCard profile={showDetails?.teacher_profile} />

                    <Pressable
                      style={({ pressed }) => [
                        styles.startWatchingBtn,
                        pressed && styles.startWatchingBtnPressed,
                      ]}
                      onPress={() => onStartWatching && onStartWatching()}
                    >
                      <Ionicons name="play" size={18} color={theme.white} />
                      <Text style={styles.startWatchingText}>Start Learning</Text>
                    </Pressable>
                  </View>
                ) : tab === 'episodes' ? (
                  <View>
                    <View style={styles.lecturesHeaderRow}>
                      {ranges.length > 0 ? (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.rangeRow}
                          style={{ flex: 1 }}
                        >
                          {ranges.map((range) => (
                            <Pressable key={range.key} onPress={() => handleRangePress(range.start)}>
                              <Text style={[styles.rangeText, activeRangeStart === range.start && styles.rangeTextActive]}>
                                {range.label}
                              </Text>
                              {activeRangeStart === range.start && <View style={styles.rangeUnderline} />}
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}

                      <TrophyProgressRing
                        completedCount={details?.completed_count || 0}
                        totalEpisodes={details?.total_episodes || item?.total_episodes || 1}
                      />
                    </View>

                    {loading ? (
                      <View style={styles.stateBlock}>
                        <ActivityIndicator size="small" color={theme.white} />
                        <Text style={styles.stateText}>Loading lectures...</Text>
                      </View>
                    ) : error ? (
                      <View style={styles.stateBlock}>
                        <Text style={styles.stateText}>{error}</Text>
                        <Pressable style={styles.retryButton} onPress={handleRetry}>
                          <Text style={styles.retryButtonText}>Try again</Text>
                        </Pressable>
                      </View>
                    ) : currentEpisodes.length > 0 ? (
                      <View style={styles.episodesList}>
                        {currentEpisodes.map((episode) => (
                          <EpisodeRow
                            key={episode.episode_id}
                            episode={episode}
                            isCurrentEpisode={episode.episode_num === currentEpisode}
                            onPress={onEpisodePress}
                          />
                        ))}
                      </View>
                    ) : (
                      <View style={styles.stateBlock}>
                        <Text style={styles.stateText}>No lectures available yet.</Text>
                      </View>
                    )}
                  </View>
                ) : tab === 'assignments' ? (
                  <AssignmentsTab
                    assignments={assignments}
                    loading={assignmentsLoading}
                    showId={item?.show_id}
                    onSubmissionSuccess={handleAssignmentSubmitted}
                  />
                ) : tab === 'materials' ? (
                  <MaterialsTab
                    materials={materials}
                    loading={materialsLoading}
                    hasAccess={materialsHasAccess}
                  />
                ) : tab === 'quizzes' ? (
                  <QuizTab
                    quizzes={quizzes}
                    loading={quizzesLoading}
                    showId={item?.show_id}
                    onAttemptCompleted={handleQuizAttemptCompleted}
                  />
                ) : null}

                {(relatedLoading || relatedShows.length > 0) && tags.length > 0 ? (
                  <View style={styles.relatedSection}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {relatedLoading ? (
                      <ActivityIndicator size="small" color={theme.primary} style={styles.relatedLoader} />
                    ) : (
                      <View style={styles.relatedGrid}>
                        {relatedShows.map((drama, index) => {
                          const isThirdColumn = (index + 1) % 3 === 0;

                          return (
                            <RelatedDramaCard
                              key={drama.id}
                              drama={drama}
                              style={{
                                marginRight: isThirdColumn ? 0 : RELATED_GAP,
                              }}
                              onPress={() => onRelatedPress?.(drama)}
                            />
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const useStyles = (theme) => StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: theme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  posterRow: {
    flexDirection: 'row',
    gap: 14,
    flex: 1,
  },
  poster: {
    width: 90,
    height: 110,
    borderRadius: 10,
    backgroundColor: theme.surface,
  },
  posterFallback: {
    borderWidth: 1,
    borderColor: theme.border,
  },
  posterMeta: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  title: {
    color: theme.text,
    fontSize: 21,
    fontWeight: '800',
  },
  metaText: {
    color: theme.gray,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  },
  tabsScroll: {
    flexGrow: 0,
    marginHorizontal: -2,
  },
  tabBtn: {
    paddingVertical: 12,
  },
  tabBtnActive: {
  },
  tabText: {
    color: theme.gray,
    fontSize: 16,
    fontWeight: '700',
  },
  tabTextActive: {
    color: theme.text,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.text,
    borderRadius: 2,
  },
  bodyScroll: {
    flex: 1,
  },
  content: {
    paddingTop: 18,
    paddingBottom: 50,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  synopsis: {
    color: theme.gray,
    fontSize: 14,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  startWatchingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  startWatchingBtnPressed: {
    opacity: 0.88,
  },
  startWatchingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tagText: {
    color: theme.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  lecturesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  rangeRow: {
    gap: 24,
  },
  rangeText: {
    color: theme.gray,
    fontSize: 14,
    fontWeight: '700',
  },
  rangeTextActive: {
    color: theme.text,
  },
  rangeUnderline: {
    marginTop: 4,
    height: 2,
    backgroundColor: theme.text,
    width: '100%',
  },
  episodesList: {
    gap: 0,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    gap: 14,
    position: 'relative',
  },
  episodeRowPending: {
    opacity: 0.5,
  },
  episodeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  episodeIconCircleActive: {
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
  episodeIconCircleUnstarted: {
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
  },
  episodeIconCircleLocked: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  episodeRowText: {
    flex: 1,
  },
  inProgressTrack: {
    height: 3,
    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
    width: '100%',
  },
  inProgressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 2,
  },
  episodeRowTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  episodeRowTitleActive: {
    color: theme.primary,
  },
  episodeRowMeta: {
    color: theme.gray,
    fontSize: 12,
    marginTop: 2,
  },
  episodeRowActiveBar: {
    width: 4,
    height: 28,
    backgroundColor: theme.primary,
    borderRadius: 2,
    position: 'absolute',
    left: -4,
    top: '50%',
    marginTop: -14,
  },
  stateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  stateText: {
    color: theme.gray,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  retryButtonText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
  },
  relatedSection: {
    marginTop: 28,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  relatedLoader: {
    marginVertical: 16,
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  relatedCard: {
    width: RELATED_CARD_WIDTH,
    marginBottom: RELATED_GAP,
  },
  relatedPoster: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    backgroundColor: theme.surface,
  },
  relatedTitle: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 16,
  },
  buyShowContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
    padding: 16,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  buyShowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 8,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  buyShowBtnPressed: {
    opacity: 0.88,
  },
  buyShowBtnDisabled: {
    opacity: 0.6,
  },
  buyShowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  buyShowCoinsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  buyShowErrorText: {
    color: theme.primary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  getCoinsBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  getCoinsText: {
    color: theme.primary,
    fontWeight: '600',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  teacherCardRoot: {
    marginTop: 20,
    marginBottom: 8,
  },
  teacherCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  teacherCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  teacherAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.background,
  },
  teacherAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherCardHeaderRight: {
    flex: 1,
    marginLeft: 16,
  },
  teacherNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  teacherHeadline: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
  },
  teacherCardBody: {
    overflow: 'hidden',
    backgroundColor: theme.surface,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderTopWidth: 0,
    paddingTop: 8, // space below the overlap
  },
  teacherBioTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
    marginTop: 8,
  },
  teacherBioText: {
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  teacherInfoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  teacherInfoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.text,
    marginRight: 6,
  },
  teacherInfoValue: {
    fontSize: 13,
    color: theme.textMuted,
    flex: 1,
  },
  certCardRoot: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    padding: 12,
    marginBottom: 16,
  },
  certIssuedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  certIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justify: 'center',
  },
  certCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.white || theme.text,
  },
  certCardSubtitle: {
    fontSize: 11,
    color: theme.gray || theme.textMuted,
    marginTop: 2,
  },
  certDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  certDownloadBtnPressed: {
    opacity: 0.8,
  },
  certDownloadBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  certReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  certReqTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.white || theme.text,
  },
  certReqSub: {
    fontSize: 11,
    color: theme.gray || theme.textMuted,
    marginTop: 2,
  },
});
