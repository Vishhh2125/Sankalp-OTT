import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import CoinIcon from '../components/CoinIcon';
import {
  fetchTopUpOptions,
  packPlanSubtitle,
  packPlanTitle,
  createWalletPaymentOrder,
  verifyPaymentOrder,
} from '../components/wallet/topUpApi';
import {
  launchCashfreeCheckout,
  CashfreeCheckoutModal,
} from '../components/payment/cashfreeCheckout';
import {
  launchPaystackCheckout,
  PaystackCheckoutModal,
} from '../components/payment/paystackCheckout';
import { ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';
import { setCoins } from '../redux/slices/authSlice';
import * as authService from '../services/authService';

import { customAlert } from '../context/CustomAlertContext';

// Commented out Cashfree & Paystack for future use
/*
const PAYMENT_GATEWAYS = [
  { id: 'cashfree', label: 'Cashfree' },
  { id: 'paystack', label: 'Paystack' },
];
*/
const PAYMENT_GATEWAYS = [
  { id: 'nationlink', label: 'Nationlink' },
];

export default function TopUpScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const coins = useSelector((s) => s.auth?.coins);

  const returnToShowPlayer = !!route.params?.returnToShowPlayer;
  const returnToForYou = !!route.params?.returnToForYou;

  const handleReturnBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate(ROUTES.MAIN_TABS, {
        screen: ROUTES.HOME,
      });
    }
  }, [navigation]);

  useLayoutEffect(() => {
    if (!returnToShowPlayer && !returnToForYou) return;
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={handleReturnBack} hitSlop={12} style={{ paddingLeft: 4 }}>
          <Ionicons name="chevron-back" size={26} color={theme.white} />
        </Pressable>
      ),
    });
  }, [navigation, returnToShowPlayer, returnToForYou, handleReturnBack]);

  const [packs, setPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [packsError, setPacksError] = useState(null);
  const [selectedPack, setSelectedPack] = useState(null);
  const [selectedGateway, setSelectedGateway] = useState('nationlink');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [pendingOrderId, setPendingOrderId] = useState(null);

  const loadPacks = useCallback(async () => {
    setPacksError(null);
    setLoadingPacks(true);
    try {
      const list = await fetchTopUpOptions(accessToken);
      setPacks(Array.isArray(list) ? list : []);
    } catch (err) {
      setPacksError(
        err?.response?.data?.message || err?.message || 'Failed to load plans'
      );
      setPacks([]);
    } finally {
      setLoadingPacks(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const onSelectPack = (pack) => {
    setSelectedPack(pack);
    setSelectedGateway('nationlink');
    setPurchaseError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setSelectedPack(null);
    setSelectedGateway('nationlink');
    setPurchaseError(null);
  };

  const applyWalletResult = async (coins) => {
    dispatch(setCoins(coins));
    await authService.patchUserDataInStore({ coins });
    setConfirmOpen(false);
    setSelectedPack(null);
    if (returnToShowPlayer || returnToForYou) {
      handleReturnBack();
    } else {
      setTimeout(() => {
        customAlert('Success', 'Coins have been added to your wallet.');
      }, 100);
    }
  };

  const finalizePayment = async (orderId) => {
    const data = await verifyPaymentOrder(orderId);
    if (data?.payment_status !== 'completed') {
      throw new Error('Payment was not completed. Please try again.');
    }
    if (typeof data?.coins !== 'number') {
      throw new Error('Invalid response from server');
    }
    await applyWalletResult(data.coins);
  };

  const onPurchase = async () => {
    if (!selectedPack?.pack_id) return;
    setPurchaseError(null);

    if (selectedGateway === 'nationlink') {
      setConfirmOpen(false);
      customAlert(
        'Under development',
        'Nationlink payment gateway is currently under development. Coming soon.'
      );
      return;
    }

    setPurchasing(true);
    try {
      const orderData = await createWalletPaymentOrder(
        selectedPack.pack_id,
        selectedGateway
      );

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

  return (
    <View style={styles.screen}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your balance</Text>
        <View style={styles.balanceRow}>
          <CoinIcon size={28} color="#FFD700" />
          <Text style={styles.balanceValue}>{String(coins ?? 0)}</Text>
          <Text style={styles.balanceUnit}>coins</Text>
        </View>
        <Text style={styles.balanceHint}>Select a pack below to top up instantly</Text>
      </View>

      <Text style={styles.sectionTitle}>Top-up plans</Text>

      {loadingPacks ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.crimson} />
        </View>
      ) : packsError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{packsError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPacks}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {packs.map((p, index) => (
            <TouchableOpacity
              key={p.pack_id}
              style={[styles.packCard, index === 0 && styles.featuredPack]}
              activeOpacity={0.9}
              onPress={() => onSelectPack(p)}
            >
              <View style={styles.packLeft}>
                <View style={styles.coinBadge}>
                  <CoinIcon size={20} color="#FFD700" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.packTitle}>{packPlanTitle(p)}</Text>
                  <Text style={styles.packSubtitle}>
                    {packPlanSubtitle(p, 'Secure payment')}
                  </Text>
                </View>
              </View>
              <View style={styles.packRight}>
                {index === 0 ? (
                  <View style={styles.popularTag}>
                    <Text style={styles.popularTagText}>BEST VALUE</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={20} color={theme.gray} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={confirmOpen}
        animationType="fade"
        transparent
        onRequestClose={closeConfirm}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmTitle}>Confirm top-up</Text>
              <TouchableOpacity onPress={closeConfirm} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={theme.gray} />
              </TouchableOpacity>
            </View>

            {selectedPack ? (
              <View style={styles.selectedPackBox}>
                <View style={styles.coinBadgeBox}>
                  <CoinIcon size={24} color="#FFD700" />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.selectedPackText}>{packPlanTitle(selectedPack)}</Text>
                  <Text style={styles.selectedPackSub}>
                    {packPlanSubtitle(selectedPack) || 'Coins will be added to your wallet'}
                  </Text>
                </View>
              </View>
            ) : null}

            {purchaseError ? (
              <Text style={styles.errorText}>{purchaseError}</Text>
            ) : null}

            <View style={styles.gatewayWrap}>
              <Text style={styles.gatewayLabel}>Choose payment gateway</Text>
              <View style={styles.gatewayList}>
                {PAYMENT_GATEWAYS.map((gateway) => (
                  <TouchableOpacity
                    key={gateway.id}
                    style={[
                      styles.gatewayCard,
                      selectedGateway === gateway.id && styles.gatewayCardActive,
                    ]}
                    onPress={() => setSelectedGateway(gateway.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.gatewayCardLeft}>
                      <Ionicons name="card-outline" size={20} color={theme.crimson} />
                      <Text
                        style={[
                          styles.gatewayCardText,
                          selectedGateway === gateway.id && styles.gatewayCardTextActive,
                        ]}
                      >
                        {gateway.label}
                      </Text>
                    </View>
                    {selectedGateway === gateway.id ? (
                      <Ionicons name="checkmark-circle" size={22} color={theme.crimson} />
                    ) : (
                      <View style={styles.gatewayRadioEmpty} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={closeConfirm}
                disabled={purchasing}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={onPurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Top Up</Text>
                )}
              </TouchableOpacity>
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
              if (data?.payment_status === 'completed' && typeof data?.coins === 'number') {
                await applyWalletResult(data.coins);
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
              if (data?.payment_status === 'completed' && typeof data?.coins === 'number') {
                await applyWalletResult(data.coins);
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
  screen: { flex: 1, backgroundColor: theme.deepBlack, paddingHorizontal: 16 },
  balanceCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  balanceLabel: { color: theme.gray, fontSize: 13, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  balanceValue: { color: theme.white, fontSize: 36, fontWeight: '800' },
  balanceUnit: { color: theme.gray, fontSize: 16, fontWeight: '600', marginTop: 8 },
  balanceHint: { color: theme.darkGray, fontSize: 12, marginTop: 12 },
  sectionTitle: {
    color: theme.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  packCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredPack: { borderColor: theme.crimson },
  packLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  coinBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,45,85,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  packTitle: { color: theme.white, fontSize: 16, fontWeight: '700' },
  packSubtitle: { color: theme.gray, fontSize: 12, marginTop: 4 },
  packRight: { alignItems: 'flex-end' },
  popularTag: {
    backgroundColor: theme.crimson,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  popularTagText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  errorBox: { alignItems: 'center', marginTop: 24 },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },
  gatewayWrap: {
    marginTop: 16,
    marginBottom: 6,
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
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.crimson,
    borderRadius: 20,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  confirmCard: {
    backgroundColor: '#16131c',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 12,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  confirmTitle: { color: theme.white, fontSize: 20, fontWeight: '700' },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  selectedPackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0b12',
    padding: 14,
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  coinBadgeBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,215,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPackText: { color: theme.white, fontSize: 16, fontWeight: '700' },
  selectedPackSub: { color: theme.gray, fontSize: 12, marginTop: 3 },
  gatewayWrap: {
    marginTop: 4,
    marginBottom: 20,
  },
  gatewayLabel: {
    color: theme.gray,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  gatewayList: {
    gap: 10,
  },
  gatewayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: '#0d0b12',
  },
  gatewayCardActive: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255,45,85,0.08)',
  },
  gatewayCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gatewayCardText: {
    color: theme.gray,
    fontSize: 15,
    fontWeight: '600',
  },
  gatewayCardTextActive: {
    color: theme.white,
    fontWeight: '700',
  },
  gatewayRadioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { color: theme.white, fontSize: 15, fontWeight: '600' },
  btnPrimary: {
    flex: 1,
    height: 48,
    backgroundColor: theme.crimson,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
