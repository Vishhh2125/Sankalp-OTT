import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import DailyCheckinPopup from '../rewards/DailyCheckinPopup';
import DramaBannerPopup from '../home/DramaBannerPopup';
import AnnouncementPopup from '../home/AnnouncementPopup';
import {
  fetchCheckinStatus,
  claimDailyCheckin,
  walletApiErrorMessage,
} from '../rewards/dailyCheckinApi';
import {
  wasCheckinPopupDismissedToday,
  markCheckinPopupDismissedToday,
  clearCheckinPopupDismissed,
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
import { setPendingHomeBanner } from '../../redux/slices/promoFlowSlice';
import { setCoins } from '../../redux/slices/authSlice';
import * as authService from '../../services/authService';

/**
 * Logged-in promo sequence:
 * - First app open today: daily → banner → notification → Home
 * - Later opens same day: banner → notification → Home
 * Each item shown once per id until admin creates new content.
 */
export default function PromoFlowGate({ children }) {
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);

  const [step, setStep] = useState(null);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [banners, setBanners] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const proceedRef = useRef(null);
  const runningRef = useRef(false);
  const appState = useRef(AppState.currentState);

  const waitForClose = () =>
    new Promise((resolve) => {
      proceedRef.current = resolve;
    });

  const advance = useCallback(() => {
    proceedRef.current?.();
    proceedRef.current = null;
    setStep(null);
  }, []);

  const runPromoFlow = useCallback(async () => {
    if (!accessToken || runningRef.current) return;
    runningRef.current = true;

    try {
      const firstOpenToday = !(await wasCheckinPopupDismissedToday());

      if (firstOpenToday) {
        try {
          const data = await fetchCheckinStatus(accessToken);
          setCheckinStatus(data);
          if (data && !data.claimed_today) {
            setStep('daily');
            await waitForClose();
          } else {
            await markCheckinPopupDismissedToday();
          }
        } catch {
          // continue to banner / notifications
        }
      }

      let unseenBanners = [];
      try {
        const [bannerList, seenBannerIds] = await Promise.all([
          fetchHomeBanners(),
          getSeenBannerIds(),
        ]);
        unseenBanners = filterUnseenBanners(bannerList.slice(0, 3), seenBannerIds);
      } catch (e) {
        console.error('Promo banners load error:', e);
      }

      if (unseenBanners.length > 0) {
        setBanners(unseenBanners);
        setStep('banner');
        await waitForClose();
      }

      let unseenAnnouncements = [];
      try {
        const [annList, seenAnnIds] = await Promise.all([
          fetchHomeAnnouncements(),
          getSeenAnnouncementIds(),
        ]);
        unseenAnnouncements = filterUnseenAnnouncements(
          annList.slice(0, 3),
          seenAnnIds
        );
      } catch (e) {
        console.error('Promo announcements load error:', e);
      }

      if (unseenAnnouncements.length > 0) {
        setAnnouncements(unseenAnnouncements);
        setStep('notification');
        await waitForClose();
      }
    } finally {
      setStep(null);
      setBanners([]);
      setAnnouncements([]);
      runningRef.current = false;
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const t = setTimeout(() => runPromoFlow(), 500);
    return () => clearTimeout(t);
  }, [accessToken, runPromoFlow]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appState.current;
      appState.current = nextState;
      if (
        accessToken &&
        (prev === 'background' || prev === 'inactive') &&
        nextState === 'active'
      ) {
        runPromoFlow();
      }
    });
    return () => sub.remove();
  }, [accessToken, runPromoFlow]);

  const onDailyDismiss = async () => {
    await markCheckinPopupDismissedToday();
    advance();
  };

  const onDailyClaim = async () => {
    if (!accessToken) return;
    setClaiming(true);
    try {
      const data = await claimDailyCheckin(accessToken);
      dispatch(setCoins(data.coins));
      await authService.patchUserDataInStore({ coins: data.coins });
      await clearCheckinPopupDismissed();
      setCheckinStatus((s) =>
        s ? { ...s, claimed_today: true, coins: data.coins } : s
      );
      Alert.alert(
        'Reward claimed',
        `You received ${data.coins_awarded} coins for Day ${data.streak_day}!`
      );
      advance();
    } catch (err) {
      Alert.alert(
        'Check-in failed',
        walletApiErrorMessage(err, 'Could not claim reward')
      );
    } finally {
      setClaiming(false);
    }
  };

  const onBannerClose = async () => {
    const ids = banners.map((b) => b.id).filter(Boolean);
    if (ids.length) await markBannerIdsSeen(ids);
    setBanners([]);
    advance();
  };

  const onBannerStartWatching = async (banner) => {
    const ids = banners.map((b) => b.id).filter(Boolean);
    if (ids.length) await markBannerIdsSeen(ids);
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
    const ids = announcements.map((a) => a.id).filter(Boolean);
    if (ids.length) await markAnnouncementIdsSeen(ids);
    setAnnouncements([]);
    advance();
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
    </>
  );
}
