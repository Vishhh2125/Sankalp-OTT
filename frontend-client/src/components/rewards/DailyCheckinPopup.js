import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../constants/theme';

function MiniDayPill({ day, coins, state }) {
  const isCurrent = state === 'current';
  const isCompleted = state === 'completed';

  return (
    <View
      style={[
        styles.pill,
        isCurrent && styles.pillCurrent,
        isCompleted && styles.pillDone,
      ]}
    >
      <Text style={[styles.pillDay, isCurrent && styles.pillDayCurrent]}>D{day}</Text>
      <Text style={styles.pillCoins}>{coins}</Text>
      {isCompleted ? (
        <Ionicons name="checkmark" size={10} color={theme.green} />
      ) : null}
    </View>
  );
}

function popupDayState(day, streakDay, claimedToday) {
  if (streakDay == null) {
    return day === 1 && !claimedToday ? 'current' : 'future';
  }
  if (day < streakDay) return 'completed';
  if (day === streakDay) return claimedToday ? 'completed' : 'current';
  return 'future';
}

export default function DailyCheckinPopup({
  visible,
  status,
  claiming,
  onClaim,
  onDismiss,
}) {
  if (!status) return null;

  const rules = status.rules ?? [];
  const streakDay = status.streak_day ?? 1;
  const claimedToday = Boolean(status.claimed_today);
  const todayReward = status.today_reward ?? 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.giftCircle}>
              <Ionicons name="gift" size={28} color={theme.gold} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Daily reward</Text>
              <Text style={styles.subtitle}>
                Day {streakDay} of 7 — check in to earn coins
              </Text>
            </View>
          </View>

          <View style={styles.rewardBox}>
            <Text style={styles.rewardLabel}>Today&apos;s reward</Text>
            <View style={styles.rewardRow}>
              <Ionicons name="logo-bitcoin" size={24} color={theme.gold} />
              <Text style={styles.rewardAmount}>{todayReward}</Text>
              <Text style={styles.rewardUnit}>coins</Text>
            </View>
          </View>

          <View style={styles.pillsRow}>
            {rules.map(({ day, coins }) => (
              <MiniDayPill
                key={day}
                day={day}
                coins={coins}
                state={popupDayState(day, streakDay, claimedToday)}
              />
            ))}
          </View>

          <Text style={styles.hint}>
            Check in every day. Miss a day and your streak restarts at Day 1.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.claimBtn,
              (claiming || claimedToday) && styles.claimBtnDisabled,
              pressed && !claiming && !claimedToday && styles.claimBtnPressed,
            ]}
            onPress={onClaim}
            disabled={claiming || claimedToday}
          >
            {claiming ? (
              <ActivityIndicator color={theme.white} />
            ) : (
              <Text style={styles.claimBtnText}>
                {claimedToday ? 'Already claimed' : `Claim ${todayReward} coins`}
              </Text>
            )}
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={onDismiss} disabled={claiming}>
            <Text style={styles.laterBtnText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  giftCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerText: { flex: 1 },
  title: { color: theme.white, fontSize: 20, fontWeight: '800' },
  subtitle: { color: theme.gray, fontSize: 13, marginTop: 4 },
  rewardBox: {
    backgroundColor: theme.deepBlack,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  rewardLabel: { color: theme.gray, fontSize: 12, marginBottom: 6 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardAmount: { color: theme.white, fontSize: 36, fontWeight: '800' },
  rewardUnit: { color: theme.gray, fontSize: 16, marginTop: 10 },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 12,
  },
  pill: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: theme.deepBlack,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 40,
  },
  pillCurrent: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
  },
  pillDone: { opacity: 0.65 },
  pillDay: { color: theme.gray, fontSize: 9, fontWeight: '700' },
  pillDayCurrent: { color: theme.crimson },
  pillCoins: { color: theme.white, fontSize: 11, fontWeight: '700' },
  hint: {
    color: theme.darkGray,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  claimBtn: {
    backgroundColor: theme.crimson,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  claimBtnDisabled: { opacity: 0.6 },
  claimBtnPressed: { opacity: 0.9 },
  claimBtnText: { color: theme.white, fontSize: 16, fontWeight: '800' },
  laterBtn: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
  laterBtnText: { color: theme.gray, fontSize: 14, fontWeight: '600' },
});
