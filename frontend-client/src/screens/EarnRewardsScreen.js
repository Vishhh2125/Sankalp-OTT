import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import CoinIcon from '../components/CoinIcon';
import GuestAccessPrompt from '../components/GuestAccessPrompt';
import {
  fetchCheckinStatus,
  claimDailyCheckin,
  walletApiErrorMessage,
} from '../components/rewards/dailyCheckinApi';
import { theme } from '../constants/theme';
import { setCoins } from '../redux/slices/authSlice';
import * as authService from '../services/authService';

function dayState(day, streakDay, claimedToday) {
  if (streakDay == null) {
    return day === 1 && !claimedToday ? 'current' : 'future';
  }
  if (day < streakDay) return 'completed';
  if (day === streakDay) {
    return claimedToday ? 'completed' : 'current';
  }
  return 'future';
}

function DayCard({ day, coins, state }) {
  const isCompleted = state === 'completed';
  const isCurrent = state === 'current';

  return (
    <View
      style={[
        styles.dayCard,
        isCurrent && styles.dayCardCurrent,
        isCompleted && styles.dayCardCompleted,
      ]}
    >
      <Text style={[styles.dayLabel, isCurrent && styles.dayLabelCurrent]}>
        Day {day}
      </Text>
      <View style={styles.coinRow}>
        <CoinIcon
          size={14}
          color={isCurrent ? theme.gold : theme.gray}
        />
        <Text style={[styles.dayCoins, isCurrent && styles.dayCoinsCurrent]}>
          {coins}
        </Text>
      </View>
      {isCompleted ? (
        <Ionicons name="checkmark-circle" size={20} color={theme.green} style={styles.dayIcon} />
      ) : isCurrent ? (
        <View style={styles.todayDot} />
      ) : (
        <Ionicons name="lock-closed" size={14} color={theme.darkGray} style={styles.dayIcon} />
      )}
    </View>
  );
}

export default function EarnRewardsScreen() {
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const coins = useSelector((s) => s.auth?.coins);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const loadStatus = useCallback(async (isRefresh = false) => {
    if (!accessToken) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchCheckinStatus(accessToken);
      setStatus(data);
    } catch (err) {
      setError(walletApiErrorMessage(err, 'Failed to load rewards'));
      setStatus(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onClaim = async () => {
    if (!accessToken || status?.claimed_today) return;
    setClaiming(true);
    try {
      const data = await claimDailyCheckin(accessToken);
      dispatch(setCoins(data.coins));
      await authService.patchUserDataInStore({ coins: data.coins });
      Alert.alert(
        'Reward claimed',
        `You received ${data.coins_awarded} coins for Day ${data.streak_day}!`
      );
      await loadStatus(true);
    } catch (err) {
      Alert.alert('Check-in failed', walletApiErrorMessage(err, 'Could not claim reward'));
    } finally {
      setClaiming(false);
    }
  };

  if (!accessToken) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <GuestAccessPrompt
          title="Sign in to earn rewards"
          subtitle="Check in daily for 7 days and collect coins configured by the platform. Streak resets after Day 7."
        />
      </View>
    );
  }

  if (loading && !status) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={theme.crimson} />
      </View>
    );
  }

  if (error && !status) {
    return (
      <View style={[styles.screen, styles.centered, styles.padH]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.gray} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => loadStatus()}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const rules = status?.rules ?? [];
  const streakDay = status?.streak_day ?? 1;
  const claimedToday = Boolean(status?.claimed_today);
  const todayReward = status?.today_reward ?? 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadStatus(true)}
            tintColor={theme.crimson}
          />
        }
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your balance</Text>
          <View style={styles.balanceRow}>
            <CoinIcon size={28} color={theme.gold} />
            <Text style={styles.balanceValue}>{coins ?? status?.coins ?? 0}</Text>
            <Text style={styles.balanceUnit}>coins</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>7-day check-in streak</Text>
        <Text style={styles.sectionSub}>
          Check in every day to earn coins. Miss a day and your streak restarts at Day 1.
          After Day 7, the cycle begins again.
        </Text>

        <View style={styles.daysGrid}>
          {rules.map(({ day, coins: dayCoins }) => (
            <DayCard
              key={day}
              day={day}
              coins={dayCoins}
              state={dayState(day, streakDay, claimedToday)}
            />
          ))}
        </View>

        {claimedToday ? (
          <View style={styles.doneBanner}>
            <Ionicons name="checkmark-circle" size={22} color={theme.green} />
            <Text style={styles.doneBannerText}>
              You checked in today (Day {streakDay}). Come back tomorrow for your next reward.
            </Text>
          </View>
        ) : (
          <View style={styles.rewardHint}>
            <Text style={styles.rewardHintText}>
              Today&apos;s reward: <Text style={styles.rewardHintBold}>{todayReward} coins</Text>
              {' '}(Day {streakDay})
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.floatingWrap}>
        <Pressable
          style={({ pressed }) => [
            styles.claimBtn,
            (claimedToday || claiming) && styles.claimBtnDisabled,
            pressed && !claimedToday && !claiming && styles.claimBtnPressed,
          ]}
          onPress={onClaim}
          disabled={claimedToday || claiming}
        >
          {claiming ? (
            <ActivityIndicator color={theme.white} />
          ) : (
            <>
              <Ionicons name="gift" size={20} color={theme.white} style={{ marginRight: 8 }} />
              <Text style={styles.claimBtnText}>
                {claimedToday ? 'Come back tomorrow' : `Claim ${todayReward} coins`}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.deepBlack },
  centered: { justifyContent: 'center', alignItems: 'center' },
  padH: { paddingHorizontal: 24 },
  container: { padding: 16, paddingBottom: 24 },
  balanceCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 24,
  },
  balanceLabel: { color: theme.gray, fontSize: 13, marginBottom: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceValue: { color: theme.white, fontSize: 32, fontWeight: '800' },
  balanceUnit: { color: theme.gray, fontSize: 16, marginTop: 8 },
  sectionTitle: {
    color: theme.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionSub: {
    color: theme.gray,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  dayCard: {
    width: '30%',
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
  dayCardCurrent: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
  },
  dayCardCompleted: {
    borderColor: 'rgba(52, 199, 89, 0.4)',
    opacity: 0.9,
  },
  dayLabel: { color: theme.gray, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  dayLabelCurrent: { color: theme.crimson },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayCoins: { color: theme.white, fontSize: 16, fontWeight: '700' },
  dayCoinsCurrent: { color: theme.gold },
  dayIcon: { marginTop: 8 },
  todayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.crimson,
    marginTop: 10,
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    padding: 14,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.35)',
  },
  doneBannerText: { flex: 1, color: '#ccc', fontSize: 13, lineHeight: 19 },
  rewardHint: {
    marginTop: 20,
    padding: 12,
    backgroundColor: theme.surface,
    borderRadius: 10,
  },
  rewardHintText: { color: theme.gray, fontSize: 14, textAlign: 'center' },
  rewardHintBold: { color: theme.gold, fontWeight: '700' },
  floatingWrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  claimBtn: {
    flexDirection: 'row',
    backgroundColor: theme.crimson,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtnDisabled: { backgroundColor: theme.border, opacity: 0.85 },
  claimBtnPressed: { opacity: 0.9 },
  claimBtnText: { color: theme.white, fontSize: 17, fontWeight: '800' },
  errorText: { color: theme.white, fontSize: 16, marginTop: 12, textAlign: 'center' },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 28,
    backgroundColor: theme.crimson,
    borderRadius: 8,
  },
  retryBtnText: { color: theme.white, fontWeight: '600' },
});
