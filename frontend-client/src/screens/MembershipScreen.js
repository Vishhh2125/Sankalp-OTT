import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import GuestAccessPrompt from '../components/GuestAccessPrompt';
import {
  fetchMembershipPlans,
  simulateMembershipPurchase,
  formatPlanPrice,
  getDurationLabel,
  formatMembershipEnd,
} from '../components/membership/membershipApi';
import { theme } from '../constants/theme';
import { patchUserProfile } from '../redux/slices/authSlice';
import * as authService from '../services/authService';

const BENEFITS = [

  { icon: 'star-outline', title: 'Members-only dramas', sub: null },
  { icon: 'infinite-outline', title: 'Unlimited Access' },
  { icon: 'lock-open-outline', title: 'Unlock Episodes' },

];

function useCountdown() {
  const [seconds, setSeconds] = useState(74097);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function MembershipScreen() {
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const userPlan = useSelector((s) => s.auth?.plan);
  const membership = useSelector((s) => s.auth?.membership);

  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);

  const countdown = useCountdown();
  const isMember = userPlan === 'MEMBER' && membership?.end_date;

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedPlans = await fetchMembershipPlans();
      setPlans(Array.isArray(fetchedPlans) ? fetchedPlans : []);
      if (fetchedPlans.length > 0) {
        setSelectedPlan((prev) => prev ?? fetchedPlans[0].id);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || 'Failed to load membership plans'
      );
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  const openConfirm = () => {
    if (!accessToken) return;
    if (!selectedPlan) return;
    setPurchaseError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPurchaseError(null);
  };

  const onConfirmPurchase = async () => {
    if (!selectedPlan) return;
    setPurchaseError(null);
    setPurchasing(true);
    try {
      const data = await simulateMembershipPurchase(selectedPlan);
      const patch = {
        plan: data?.plan ?? 'MEMBER',
        coins: data?.coins,
        membership: data?.membership ?? null,
      };
      dispatch(patchUserProfile(patch));
      await authService.patchUserDataInStore(patch);
      setConfirmOpen(false);
      Alert.alert(
        'Membership active',
        data?.membership?.end_date
          ? `All locked episodes are unlocked until ${formatMembershipEnd(data.membership.end_date)}.`
          : 'Your membership is now active.'
      );
    } catch (err) {
      setPurchaseError(
        err?.response?.data?.message || err?.message || 'Purchase failed'
      );
    } finally {
      setPurchasing(false);
    }
  };

  if (!accessToken) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <GuestAccessPrompt
          title="Sign in to join membership"
          subtitle="Create an account to unlock all episodes and enjoy member benefits for the plan you choose."
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={theme.crimson} />
      </View>
    );
  }

  if (error || plans.length === 0) {
    return (
      <View style={[styles.screen, styles.centered, { paddingHorizontal: 20 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.gray} />
        <Text style={styles.errorText}>{error || 'No membership plans available'}</Text>
        <Pressable style={styles.retryBtn} onPress={loadPlans}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
      >
        <View style={styles.heroArea}>
          <View style={styles.heroGradient} />
          <Text style={styles.heroTitle}>Join Membership</Text>
          {isMember ? (
            <Text style={styles.heroSub}>
              Active until {formatMembershipEnd(membership.end_date)}
              {membership.plan_name ? ` · ${membership.plan_name}` : ''}
            </Text>
          ) : (
            <Text style={styles.heroSub}>Unlock all episodes while your plan is active</Text>
          )}
        </View>

        {isMember ? (
          <View style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#4CD964" />
            <Text style={styles.activeBannerText}>
              You are a member — locked episodes play without coins until{' '}
              {formatMembershipEnd(membership.end_date)}. Extend below anytime.
            </Text>
          </View>
        ) : null}

        <View style={styles.plansSection}>
          {plans.map((plan) => (
            <Pressable
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardActive,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              <View style={styles.planLeft}>
                <View
                  style={[
                    styles.planRadio,
                    selectedPlan === plan.id && styles.planRadioActive,
                  ]}
                >
                  {selectedPlan === plan.id ? (
                    <Ionicons name="checkmark" size={16} color={theme.white} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name} Membership</Text>
                  <Text style={styles.planPrice}>
                    {formatPlanPrice(plan.price, plan.currency)} /{getDurationLabel(plan.duration)}
                  </Text>
                  {(plan.duration === 'weekly' || plan.duration === 'week') && (
                    <Text style={styles.planDetail}>
                      {formatPlanPrice(plan.price, plan.currency)} per week
                    </Text>
                  )}
                </View>
              </View>
              {selectedPlan === plan.id &&
              (plan.duration === 'weekly' || plan.duration === 'week') ? (
                <View style={styles.discountTag}>
                  <Text style={styles.discountTagText}>Discount {countdown}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        <Text style={styles.whyTitle}>Why Join?</Text>
        <View style={styles.benefitsList}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitItem}>
              <Ionicons
                name={b.icon}
                size={24}
                color={theme.crimson}
                style={styles.benefitIcon}
              />
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                {b.sub ? <Text style={styles.benefitSub}>{b.sub}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.floatingBtnWrap}>
        <Pressable
          style={({ pressed }) => [styles.joinBtn, pressed && styles.joinBtnPressed]}
          onPress={openConfirm}
        >
          <Text style={styles.joinBtnText}>
            {isMember ? 'Extend Membership' : 'Join Now'}
          </Text>
          <Text style={styles.joinBtnSub}>Simulated payment · Cancel anytime</Text>
        </Pressable>
      </View>

      <Modal
        visible={confirmOpen}
        animationType="fade"
        transparent
        onRequestClose={closeConfirm}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm purchase</Text>
            {selectedPlanData ? (
              <View style={styles.confirmPlanBox}>
                <Ionicons name="star" size={22} color="#FFD700" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.confirmPlanName}>
                    {selectedPlanData.name} Membership
                  </Text>
                  <Text style={styles.confirmPlanPrice}>
                    {formatPlanPrice(selectedPlanData.price, selectedPlanData.currency)} /{' '}
                    {getDurationLabel(selectedPlanData.duration)}
                  </Text>
                  <Text style={styles.confirmPlanHint}>
                    Unlocks all paid episodes for the plan duration
                  </Text>
                </View>
              </View>
            ) : null}
            {purchaseError ? (
              <Text style={styles.purchaseError}>{purchaseError}</Text>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable style={styles.btnSecondary} onPress={closeConfirm} disabled={purchasing}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.btnPrimary}
                onPress={onConfirmPurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Purchase</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.deepBlack },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  container: { paddingBottom: 20 },
  heroArea: {
    height: 160,
    backgroundColor: theme.border,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 0, 16, 0.6)',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: theme.white, zIndex: 1 },
  heroSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 6,
    zIndex: 1,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: 'rgba(76,217,100,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(76,217,100,0.35)',
  },
  activeBannerText: {
    flex: 1,
    color: '#ccc',
    fontSize: 13,
    lineHeight: 19,
  },
  plansSection: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  planCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardActive: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255, 45, 85, 0.08)',
  },
  planLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planRadio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  planRadioActive: { borderColor: theme.crimson, backgroundColor: theme.crimson },
  planName: { color: theme.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  planPrice: { color: theme.white, fontSize: 18, fontWeight: '800' },
  planDetail: { color: theme.gray, fontSize: 11, marginTop: 4, lineHeight: 16 },
  discountTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.crimson,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomLeftRadius: 10,
  },
  discountTagText: { color: theme.white, fontSize: 11, fontWeight: '700' },
  whyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.white,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 16,
  },
  benefitsList: { paddingHorizontal: 20, gap: 20 },
  benefitItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  benefitIcon: { marginTop: 2 },
  benefitTextWrap: { flex: 1 },
  benefitTitle: { color: theme.white, fontSize: 15, fontWeight: '600' },
  benefitSub: { color: theme.gray, fontSize: 13, marginTop: 2 },
  floatingBtnWrap: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  joinBtn: {
    backgroundColor: theme.crimson,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  joinBtnPressed: { opacity: 0.85 },
  joinBtnText: { color: theme.white, fontSize: 17, fontWeight: '800' },
  joinBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  errorText: { color: theme.white, fontSize: 16, marginTop: 12, textAlign: 'center' },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 30,
    backgroundColor: theme.crimson,
    borderRadius: 8,
  },
  retryBtnText: { color: theme.white, fontWeight: '600' },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
  },
  confirmTitle: { color: theme.white, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  confirmPlanBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.deepBlack,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  confirmPlanName: { color: theme.white, fontSize: 16, fontWeight: '700' },
  confirmPlanPrice: { color: theme.gray, fontSize: 14, marginTop: 4 },
  confirmPlanHint: { color: theme.darkGray, fontSize: 12, marginTop: 6 },
  purchaseError: { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btnSecondary: { paddingVertical: 12, paddingHorizontal: 16 },
  btnSecondaryText: { color: theme.gray, fontSize: 16, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: theme.crimson,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
