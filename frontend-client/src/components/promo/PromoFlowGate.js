import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import DailyCheckinPopup from '../rewards/DailyCheckinPopup';
import DramaBannerPopup from '../home/DramaBannerPopup';
import AnnouncementPopup from '../home/AnnouncementPopup';
import MembershipExpiryPopup from '../membership/MembershipExpiryPopup';
import { getMembershipExpiryReminder } from '../membership/membershipExpiryUtils';
import {
  markMembershipExpiryDismissedToday,
  wasMembershipExpiryDismissedToday,
} from '../membership/membershipExpiryStorage';
import {
  fetchCheckinStatus,
  claimDailyCheckin,
  walletApiErrorMessage,
} from '../rewards/dailyCheckinApi';
import {
  wasCheckinPopupDismissedToday,
  markCheckinPopupDismissedToday,
} from '../rewards/dailyCheckinStorage';
import { fetchHomeBanners, fetchHomeAnnouncements } from '../home/homePromoApi';
import {
  filterUnseenAnnouncements,
  filterUnseenBanners,
  getSeenAnnouncementIds,
  getSeenBannerIds,
  markAnnouncementIdsSeen,
  markBannerIdsSeen,
} from '../home/homePromoStorage';
import {
  hasCompletedWelcomePromo,
  markWelcomePromoCompleted,
} from './promoFlowStorage';
import { setPendingHomeBanner } from '../../redux/slices/promoFlowSlice';
import { patchUserProfile, setCoins } from '../../redux/slices/authSlice';
import { ROUTES } from '../../constants/routes';
import * as authService from '../../services/authService';
import { customAlert } from '../../context/CustomAlertContext';

const MODAL_SETTLE_MS = 120;

function pause(ms = MODAL_SETTLE_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Logged-in promo sequence:
 * - New user (first session): daily → banner → notification → Home
 * - First app open today (returning): daily → banner → notification → Home
 * - Later opens same day: banner → notification → membership expiry (if 3/2 days left) → Home
 *
 * NOTE: /auth/me is intentionally NOT called here. User profile syncing
 * (coins, plan, membership) is owned by useUserDataSync which runs on a
 * 200-second interval in RootStackNavigator. We read the Redux values that
 * useUserDataSync already keeps fresh, avoiding duplicate network calls and
 * the render-loop that duplicate dispatches used to cause.
 */
export default function PromoFlowGate({ children }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const userId = useSelector((s) => s.auth?.userId);
  const plan = useSelector((s) => s.auth?.plan);
  const memberships = useSelector((s) => s.auth?.memberships) || [];
  const hasAllAccess = useSelector((s) => s.auth?.has_all_access);

  const [step, setStep] = useState(null);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [banners, setBanners] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [membershipReminder, setMembershipReminder] = useState(null);

  const proceedRef = useRef(null);
  const runningRef = useRef(false);
  const appState = useRef(AppState.currentState);
  const bannersRef = useRef([]);
  const announcementsRef = useRef([]);
  const userIdRef = useRef(userId);

  // ─── Stable refs for Redux values used inside runPromoFlow ────────────────
  // Keeping plan/membership as refs (instead of closing over them in
  // useCallback deps) is what prevents the re-creation chain:
  //   plan/membership change → refreshMembershipProfile new ref
  //   → runPromoFlow new ref → useEffect re-fires → runningRef bypassed → loop
  const planRef = useRef(plan);
  const membershipRef = useRef(memberships);
  const accessTokenRef = useRef(accessToken);

  userIdRef.current = userId;
  bannersRef.current = banners;
  announcementsRef.current = announcements;
  planRef.current = plan;
  membershipRef.current = memberships;
  accessTokenRef.current = accessToken;
  // ─────────────────────────────────────────────────────────────────────────

  const waitForClose = () =>
    new Promise((resolve) => {
      proceedRef.current = resolve;
    });

  const advance = useCallback(() => {
    proceedRef.current?.();
    proceedRef.current = null;
    setStep(null);
  }, []);

  const resolveUserId = useCallback(async () => {
    if (userIdRef.current) return userIdRef.current;
    const user = await authService.getUserData();
    return user?.id ?? null;
  }, []);

  /**
   * Reads the plan/membership that useUserDataSync already keeps fresh in
   * Redux (via the planRef/membershipRef). Does NOT call /auth/me — that
   * is exclusively useUserDataSync's responsibility.
   *
   * Stable identity: depends only on dispatch, which never changes.
   */
  const refreshMembershipProfile = useCallback(() => {
    // Return the current ref values synchronously — no network call needed.
    // useUserDataSync has already synced these from the backend.
    return Promise.resolve({
      plan: planRef.current,
      memberships: membershipRef.current,
    });
  }, [dispatch]); // dispatch is stable; plan/membership accessed via refs

  const runPromoFlow = useCallback(async () => {
    if (!accessTokenRef.current || runningRef.current) return;
    runningRef.current = true;

    let uid = null;
    let isWelcomeSession = false;

    try {
      uid = await resolveUserId();
      isWelcomeSession = uid ? !(await hasCompletedWelcomePromo(uid)) : false;

      const firstOpenToday = !(await wasCheckinPopupDismissedToday(uid));
      const showDaily = isWelcomeSession || firstOpenToday;

      if (showDaily) {
        try {
          const data = await fetchCheckinStatus(accessTokenRef.current);
          setCheckinStatus(data);
          if (data && !data.claimed_today) {
            setStep('daily');
            await pause();
            await waitForClose();
          } else {
            await markCheckinPopupDismissedToday(uid);
          }
        } catch {
          // continue to banner / notifications
        }
      }

      let unseenBanners = [];
      try {
        const [bannerList, seenBannerIds] = await Promise.all([
          fetchHomeBanners(),
          getSeenBannerIds(uid),
        ]);
        const recent = bannerList.slice(0, 3);
        unseenBanners = isWelcomeSession
          ? recent
          : filterUnseenBanners(recent, seenBannerIds);
      } catch (e) {
        console.error('Promo banners load error:', e);
      }

      if (unseenBanners.length > 0) {
        setBanners(unseenBanners);
        setStep('banner');
        await pause();
        await waitForClose();
      }

      let unseenAnnouncements = [];
      try {
        const [annList, seenAnnIds] = await Promise.all([
          fetchHomeAnnouncements(),
          getSeenAnnouncementIds(uid),
        ]);
        const recent = annList.slice(0, 3);
        unseenAnnouncements = isWelcomeSession
          ? recent
          : filterUnseenAnnouncements(recent, seenAnnIds);
      } catch (e) {
        console.error('Promo announcements load error:', e);
      }

      if (unseenAnnouncements.length > 0) {
        setAnnouncements(unseenAnnouncements);
        setStep('notification');
        await pause();
        await waitForClose();
      }

      // Read plan/membership from refs — already kept fresh by useUserDataSync
      const profile = await refreshMembershipProfile();
      const reminder = getMembershipExpiryReminder({
        plan: profile.plan,
        memberships: profile.memberships,
      });
      if (
        reminder &&
        uid &&
        !(await wasMembershipExpiryDismissedToday(uid, reminder.daysLeft))
      ) {
        setMembershipReminder(reminder);
        setStep('membershipExpiry');
        await pause();
        await waitForClose();
      }

      if (isWelcomeSession && uid) {
        await markWelcomePromoCompleted(uid);
      }
    } finally {
      setStep(null);
      setBanners([]);
      setAnnouncements([]);
      setMembershipReminder(null);
      runningRef.current = false;
    }
  }, [resolveUserId, refreshMembershipProfile]);
  // accessToken intentionally read via accessTokenRef inside the callback so
  // this function's identity stays stable across token refreshes.

  useEffect(() => {
    if (!accessToken) return undefined;
    const t = setTimeout(() => runPromoFlow(), 600);
    return () => clearTimeout(t);
  }, [accessToken, userId, runPromoFlow]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appState.current;
      appState.current = nextState;
      if (
        accessTokenRef.current &&
        (prev === 'background' || prev === 'inactive') &&
        nextState === 'active'
      ) {
        runPromoFlow();
      }
    });
    return () => sub.remove();
  }, [runPromoFlow]);

  const onDailyDismiss = async () => {
    const uid = await resolveUserId();
    await markCheckinPopupDismissedToday(uid);
    advance();
  };

  const onDailyClaim = async () => {
    if (!accessTokenRef.current) return;
    setClaiming(true);
    try {
      const data = await claimDailyCheckin(accessTokenRef.current);
      dispatch(setCoins(data.coins));
      await authService.patchUserDataInStore({ coins: data.coins });
      const uid = await resolveUserId();
      await markCheckinPopupDismissedToday(uid);
      setCheckinStatus((s) =>
        s ? { ...s, claimed_today: true, coins: data.coins } : s
      );

      customAlert(
        'Reward claimed',
        `You received ${data.coins_awarded} coins for Day ${data.streak_day}!`
      );
      advance();
    } catch (err) {
      customAlert(
        'Check-in failed',
        walletApiErrorMessage(err, 'Could not claim reward')
      );
    } finally {
      setClaiming(false);
    }
  };

  const onBannerClose = async () => {
    const uid = await resolveUserId();
    const ids = bannersRef.current.map((b) => b.id).filter(Boolean);
    if (ids.length) await markBannerIdsSeen(ids, uid);
    setBanners([]);
    advance();
  };

  const onBannerStartWatching = async (banner) => {
    const uid = await resolveUserId();
    const ids = bannersRef.current.map((b) => b.id).filter(Boolean);
    if (ids.length) await markBannerIdsSeen(ids, uid);
    setBanners([]);
    if (banner?.show_id) {
      dispatch(
        setPendingHomeBanner({
          id: banner.show_id,
          title: banner.show_title || banner.title,
          thumbnail_url: banner.show_thumbnail_url || banner.image_url,
        })
      );
    }
    advance();
  };

  const onNotificationDismiss = async () => {
    const uid = await resolveUserId();
    const ids = announcementsRef.current.map((a) => a.id).filter(Boolean);
    if (ids.length) await markAnnouncementIdsSeen(ids, uid);
    setAnnouncements([]);
    advance();
  };

  const onMembershipExpiryDismiss = async () => {
    const uid = await resolveUserId();
    if (uid && membershipReminder?.daysLeft) {
      await markMembershipExpiryDismissedToday(uid, membershipReminder.daysLeft);
    }
    setMembershipReminder(null);
    advance();
  };

  const onMembershipExtend = async () => {
    const uid = await resolveUserId();
    if (uid && membershipReminder?.daysLeft) {
      await markMembershipExpiryDismissedToday(uid, membershipReminder.daysLeft);
    }
    setMembershipReminder(null);
    advance();
    navigation.navigate(ROUTES.MAIN_TABS, {
      screen: ROUTES.PROFILE,
      params: {
        screen: ROUTES.MEMBERSHIP,
        params: { backToHome: true },
      },
    });
  };

  return (
    <>
      {children}
      <DailyCheckinPopup
        visible={step === 'daily'}
        status={checkinStatus}
        claiming={claiming}
        onClaim={onDailyClaim}
        onDismiss={onDailyDismiss}
      />
      <DramaBannerPopup
        visible={step === 'banner'}
        banners={banners}
        onClose={onBannerClose}
        onStartWatching={onBannerStartWatching}
      />
      <AnnouncementPopup
        visible={step === 'notification'}
        announcements={announcements}
        onDismiss={onNotificationDismiss}
      />
      <MembershipExpiryPopup
        visible={step === 'membershipExpiry'}
        reminder={membershipReminder}
        onExtend={onMembershipExtend}
        onDismiss={onMembershipExpiryDismiss}
      />
    </>
  );
}