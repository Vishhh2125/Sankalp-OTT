import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import GuestAccessPrompt from '../components/GuestAccessPrompt';
import {
  fetchMembershipPlans,
  createSubscriptionPaymentOrder,
  verifyPaymentOrder,
  formatPlanPrice,
  getDurationLabel,
  formatMembershipEnd,
  getPlanUnlockScopeLabel,
  findBlockingLifetimeMembership,
  blockingLifetimeMessage,
  isLifetimePlan,
} from '../components/membership/membershipApi';
import {
  launchCashfreeCheckout,
  CashfreeCheckoutModal,
} from '../components/payment/cashfreeCheckout';
import {
  launchPaystackCheckout,
  PaystackCheckoutModal,
} from '../components/payment/paystackCheckout';
import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';
import { patchUserProfile } from '../redux/slices/authSlice';
import * as authService from '../services/authService';

const BENEFITS = [

  { icon: 'star-outline', title: 'Members-only dramas', sub: null },
  { icon: 'infinite-outline', title: 'Unlimited Access' },
  { icon: 'lock-open-outline', title: 'Unlock Episodes' },

];

const PAYMENT_GATEWAYS = [
  { id: 'cashfree', label: 'Cashfree' },
  { id: 'paystack', label: 'Paystack' },
];

export default function MembershipScreen({ navigation }) {
  const route = useRoute();
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const userPlan = useSelector((s) => s.auth?.plan);
  const memberships = useSelector((s) => s.auth?.memberships) || [];
  const hasAllAccess = useSelector((s) => s.auth?.has_all_access);

  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState('__all__');
  const [selectedGateway, setSelectedGateway] = useState('cashfree');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [pendingOrderId, setPendingOrderId] = useState(null);

  const isMember = userPlan === 'MEMBER' && memberships.length > 0;
  const returningHomeRef = useRef(false);

  const backToHome = !!route.params?.backToHome;

  const returnToHome = useCallback(() => {
    returningHomeRef.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: ROUTES.PROFILE }],
    });
    navigation.getParent()?.navigate(ROUTES.HOME);
  }, [navigation]);

  useEffect(() => {
    if (!backToHome) return undefined;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (returningHomeRef.current) return;
      if (!['GO_BACK', 'POP'].includes(e.data.action.type)) return;
      e.preventDefault();
      returnToHome();
    });
    return unsubscribe;
  }, [navigation, backToHome, returnToHome]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => {
            if (backToHome) {
              returnToHome();
              return;
            }
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate(ROUTES.PROFILE);
            }
          }}
          hitSlop={12}
          style={{ paddingLeft: 4 }}
        >
          <Ionicons name="chevron-back" size={26} color={theme.white} />
        </Pressable>
      ),
    });
  }, [navigation, backToHome, returnToHome]);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedPlans = await fetchMembershipPlans();
      setPlans(Array.isArray(fetchedPlans) ? fetchedPlans : []);
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

  const planGroups = useMemo(() => {
    const allPlans = plans.filter((p) => !p.category_id);
    const byCategory = {};
    plans
      .filter((p) => p.category_id)
      .forEach((p) => {
        if (!byCategory[p.category_id]) {
          byCategory[p.category_id] = {
            id: p.category_id,
            name: p.category_name || 'Category',
            plans: [],
          };
        }
        byCategory[p.category_id].plans.push(p);
      });
    return {
      all: allPlans,
      categories: Object.values(byCategory).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [plans]);

  const categoryTabs = useMemo(() => {
    const tabs = [];
    if (planGroups.all.length > 0) {
      tabs.push({ id: '__all__', label: 'All Categories' });
    }
    planGroups.categories.forEach((g) => tabs.push({ id: g.id, label: g.name }));
    return tabs;
  }, [planGroups]);

  const visiblePlans = useMemo(() => {
    if (activeCategoryTab === '__all__') return planGroups.all;
    const group = planGroups.categories.find((g) => g.id === activeCategoryTab);
    return group?.plans || [];
  }, [activeCategoryTab, planGroups]);

  useEffect(() => {
    if (categoryTabs.length === 0) return;
    if (!categoryTabs.some((t) => t.id === activeCategoryTab)) {
      setActiveCategoryTab(categoryTabs[0].id);
    }
  }, [categoryTabs, activeCategoryTab]);

  useEffect(() => {
    if (visiblePlans.length === 0) {
      setSelectedPlan(null);
      return;
    }
    if (!visiblePlans.some((p) => p.id === selectedPlan)) {
      setSelectedPlan(visiblePlans[0].id);
    }
  }, [visiblePlans, selectedPlan]);

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);
  const blockingLifetime = selectedPlanData
    ? findBlockingLifetimeMembership(memberships, selectedPlanData)
    : null;
  const blockMessage = blockingLifetimeMessage(blockingLifetime);

  const openConfirm = () => {
    if (!accessToken) return;
    if (!selectedPlan) return;
    if (blockMessage) {
      setPurchaseError(blockMessage);
      setConfirmOpen(true);
      return;
    }
    setPurchaseError(null);
    setSelectedGateway('cashfree');
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPurchaseError(null);
    setSelectedGateway('cashfree');
  };

  const applyMembershipResult = async (data) => {
    const patch = {
      plan: data?.plan ?? 'MEMBER',
      coins: data?.coins,
      memberships: data?.memberships ?? [],
      has_all_access: data?.has_all_access ?? false,
    };
    dispatch(patchUserProfile(patch));
    await authService.patchUserDataInStore(patch);
    setConfirmOpen(false);
    const purchased = data?.memberships?.find((m) => m.plan_id === selectedPlan);
    const scope = purchased?.category_name
      ? purchased.category_name
      : getPlanUnlockScopeLabel(selectedPlanData);
    setTimeout(() => {
      Alert.alert(
        'Membership active',
        purchased?.end_date
          ? `${scope} dramas are unlocked until ${formatMembershipEnd(purchased.end_date)}.`
          : `You now have lifetime access to ${scope}.`
      );
    }, 100);
  };

  const finalizePayment = async (orderId) => {
    const data = await verifyPaymentOrder(orderId);
    if (data?.payment_status !== 'completed') {
      throw new Error('Payment was not completed. Please try again.');
    }
    await applyMembershipResult(data);
  };

  const onConfirmPurchase = async () => {
    if (!selectedPlan) return;
    setPurchaseError(null);
    setPurchasing(true);
    try {
      const orderData = await createSubscriptionPaymentOrder(selectedPlan, selectedGateway);
      setPendingOrderId(orderData.order_id);
      setConfirmOpen(false);

      if (selectedGateway === 'paystack') {
        if (!orderData?.authorization_url || !orderData?.order_id) {
          throw new Error('Invalid payment order response');
        }

        const checkout = await launchPaystackCheckout({
          publicKey: orderData.paystack_public_key,
          email: orderData.customer_email,
          amount: orderData.order_amount,
          currency: orderData.order_currency || 'NGN',
          reference: orderData.order_id,
          authorizationUrl: orderData.authorization_url,
          callbackUrl: orderData.callback_url,
          onSuccess: async () => {
            setCheckoutSession(null);
            try {
              await finalizePayment(orderData.order_id);
            } catch (err) {
              setPurchaseError(
                err?.response?.data?.message || err?.message || 'Payment verification failed'
              );
              setConfirmOpen(true);
            } finally {
              setPurchasing(false);
            }
          },
          onFailure: (err) => {
            setPurchasing(false);
            setCheckoutSession(null);
            setPurchaseError(err?.message || 'Payment cancelled or failed');
            setConfirmOpen(true);
          },
        });

        if (checkout.method === 'webview') {
          setCheckoutSession({
            gateway: 'paystack',
            authorizationUrl: orderData.authorization_url,
            callbackUrl: orderData.callback_url,
            reference: orderData.order_id,
          });
          setPurchasing(false);
        }
      } else {
        if (!orderData?.payment_session_id || !orderData?.order_id) {
          throw new Error('Invalid payment order response');
        }

        const checkout = await launchCashfreeCheckout({
          paymentSessionId: orderData.payment_session_id,
          orderId: orderData.order_id,
          mode: orderData.cashfree_mode || 'sandbox',
          onSuccess: async () => {
            setCheckoutSession(null);
            try {
              await finalizePayment(orderData.order_id);
            } catch (err) {
              setPurchaseError(
                err?.response?.data?.message || err?.message || 'Payment verification failed'
              );
              setConfirmOpen(true);
            } finally {
              setPurchasing(false);
            }
          },
          onFailure: (err) => {
            setPurchasing(false);
            setCheckoutSession(null);
            setPurchaseError(err?.message || 'Payment cancelled or failed');
            setConfirmOpen(true);
          },
        });

        if (checkout.method === 'webview') {
          setCheckoutSession({
            gateway: 'cashfree',
            paymentSessionId: orderData.payment_session_id,
            mode: orderData.cashfree_mode || 'sandbox',
          });
          setPurchasing(false);
        }
      }
    } catch (err) {
      setPurchaseError(
        err?.response?.data?.message || err?.message || 'Purchase failed'
      );
      setPurchasing(false);
    }
  };

  const onCheckoutModalSuccess = async () => {
    if (!pendingOrderId) return;
    const orderId = pendingOrderId;
    setCheckoutSession(null);
    setPendingOrderId(null);
    setPurchasing(true);
    try {
      await finalizePayment(orderId);
    } catch (err) {
      setPurchaseError(
        err?.response?.data?.message || err?.message || 'Payment verification failed'
      );
      setConfirmOpen(true);
    } finally {
      setPurchasing(false);
    }
  };

  const onCheckoutModalFailure = (err) => {
    setCheckoutSession(null);
    setPendingOrderId(null);
    setPurchaseError(err?.message || 'Payment cancelled or failed');
    setConfirmOpen(true);
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
              {memberships.length} active membership{memberships.length === 1 ? '' : 's'}
              {hasAllAccess ? ' · All categories' : ''}
            </Text>
          ) : (
            <Text style={styles.heroSub}>Unlock paid episodes for the categories you choose</Text>
          )}
        </View>

        {isMember ? (
          <View style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#4CD964" />
            <View style={{ flex: 1 }}>
              {memberships.map((m) => (
                <Text key={m.id} style={styles.activeBannerText}>
                  {m.plan_name || 'Membership'}
                  {m.category_name ? ` · ${m.category_name}` : ' · All categories'}
                  {' — '}
                  {m.end_date
                    ? `until ${formatMembershipEnd(m.end_date)}`
                    : 'Lifetime access'}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {categoryTabs.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {categoryTabs.map((tab) => (
              <Pressable
                key={tab.id}
                style={[
                  styles.categoryTab,
                  activeCategoryTab === tab.id && styles.categoryTabActive,
                ]}
                onPress={() => setActiveCategoryTab(tab.id)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategoryTab === tab.id && styles.categoryTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.plansSection}>
          {visiblePlans.map((plan) => (
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
                  <Text style={styles.planScope}>
                    {plan.category_id ? plan.category_name : 'All categories'}
                  </Text>
                  <Text style={styles.planPrice}>
                    {formatPlanPrice(plan.price, plan.currency)}
                    {isLifetimePlan(plan)
                      ? ' · one-time payment'
                      : ` /${getDurationLabel(plan.duration)}`}
                  </Text>
                  {isLifetimePlan(plan) ? (
                    <Text style={styles.planDetail}>Lifetime access · never expires</Text>
                  ) : (plan.duration === 'weekly' || plan.duration === 'week') ? (
                    <Text style={styles.planDetail}>
                      {formatPlanPrice(plan.price, plan.currency)} per week
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
          {visiblePlans.length === 0 ? (
            <Text style={styles.emptyPlansText}>No plans in this category yet.</Text>
          ) : null}
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
          <Text style={styles.joinBtnSub}>
            {isLifetimePlan(selectedPlanData)
              ? 'One-time payment'
              : 'Secure payment via Cashfree or Paystack'}
          </Text>
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
                    {formatPlanPrice(selectedPlanData.price, selectedPlanData.currency)}
                    {isLifetimePlan(selectedPlanData)
                      ? ' · one-time payment'
                      : ` / ${getDurationLabel(selectedPlanData.duration)}`}
                  </Text>
                  <Text style={styles.confirmPlanHint}>
                    Unlocks {getPlanUnlockScopeLabel(selectedPlanData)} paid episodes
                    {isLifetimePlan(selectedPlanData)
                      ? ' for life'
                      : ' for the plan duration'}
                  </Text>
                </View>
              </View>
            ) : null}
            {blockMessage ? (
              <Text style={styles.purchaseError}>{blockMessage}</Text>
            ) : null}
            {purchaseError && !blockMessage ? (
              <Text style={styles.purchaseError}>{purchaseError}</Text>
            ) : null}
            <View style={styles.gatewayWrap}>
              <Text style={styles.gatewayLabel}>Choose payment gateway</Text>
              <View style={styles.gatewayRow}>
                {PAYMENT_GATEWAYS.map((gateway) => (
                  <Pressable
                    key={gateway.id}
                    style={[
                      styles.gatewayChip,
                      selectedGateway === gateway.id && styles.gatewayChipActive,
                    ]}
                    onPress={() => setSelectedGateway(gateway.id)}
                  >
                    <Text
                      style={[
                        styles.gatewayChipText,
                        selectedGateway === gateway.id && styles.gatewayChipTextActive,
                      ]}
                    >
                      {gateway.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.confirmActions}>
              <Pressable style={styles.btnSecondary} onPress={closeConfirm} disabled={purchasing}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, blockMessage && styles.btnPrimaryDisabled]}
                onPress={onConfirmPurchase}
                disabled={purchasing || !!blockMessage}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Pay Now</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CashfreeCheckoutModal
        visible={checkoutSession?.gateway === 'cashfree'}
        paymentSessionId={checkoutSession?.paymentSessionId}
        mode={checkoutSession?.mode}
        onClose={async () => {
          const orderId = pendingOrderId;
          setCheckoutSession(null);
          setPendingOrderId(null);
          if (orderId) {
            try {
              const data = await verifyPaymentOrder(orderId);
              if (data?.payment_status === 'completed') {
                await applyMembershipResult(data);
              }
            } catch (err) {
              // Fail silently if closed without payment completion
            }
          }
        }}
        onSuccess={onCheckoutModalSuccess}
        onFailure={onCheckoutModalFailure}
      />

      <PaystackCheckoutModal
        visible={checkoutSession?.gateway === 'paystack'}
        authorizationUrl={checkoutSession?.authorizationUrl}
        callbackUrl={checkoutSession?.callbackUrl}
        reference={checkoutSession?.reference}
        onClose={async () => {
          const orderId = pendingOrderId;
          setCheckoutSession(null);
          setPendingOrderId(null);
          if (orderId) {
            try {
              const data = await verifyPaymentOrder(orderId);
              if (data?.payment_status === 'completed') {
                await applyMembershipResult(data);
              }
            } catch (err) {
              // Fail silently if closed without payment completion
            }
          }
        }}
        onSuccess={onCheckoutModalSuccess}
        onFailure={onCheckoutModalFailure}
      />
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
  planScope: { color: theme.gray, fontSize: 12, marginBottom: 4 },
  categoryTabs: { maxHeight: 44, marginTop: 8 },
  categoryTabsContent: { paddingHorizontal: 16, gap: 8 },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  categoryTabActive: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
  },
  categoryTabText: { color: theme.gray, fontSize: 12, fontWeight: '600' },
  categoryTabTextActive: { color: theme.white },
  emptyPlansText: {
    color: theme.gray,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
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
  gatewayWrap: {
    marginBottom: 12,
  },
  gatewayLabel: {
    color: theme.gray,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  gatewayRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gatewayChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.deepBlack,
    alignItems: 'center',
  },
  gatewayChipActive: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255,45,85,0.12)',
  },
  gatewayChipText: {
    color: theme.gray,
    fontWeight: '700',
  },
  gatewayChipTextActive: {
    color: theme.white,
  },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btnSecondary: { paddingVertical: 12, paddingHorizontal: 16 },
  btnSecondaryText: { color: theme.gray, fontSize: 16, fontWeight: '600' },
  planDetail: { color: theme.gray, fontSize: 11, marginTop: 4, lineHeight: 16 },
  btnPrimaryDisabled: { opacity: 0.45 },
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
