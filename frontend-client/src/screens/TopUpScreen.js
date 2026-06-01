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
  simulatePurchase,
} from '../components/wallet/topUpApi';
import { ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';
import { setCoins } from '../redux/slices/authSlice';
import * as authService from '../services/authService';

export default function TopUpScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const coins = useSelector((s) => s.auth?.coins);

  const returnToShowPlayer = !!route.params?.returnToShowPlayer;

  const handleBackToPlayer = useCallback(() => {
    navigation.navigate(ROUTES.SHOW_PLAYER, {
      fromHome: !!route.params?.fromHome,
      fromForYou: !!route.params?.fromForYou,
    });
  }, [navigation, route.params?.fromHome, route.params?.fromForYou]);

  useLayoutEffect(() => {
    if (!returnToShowPlayer) return;
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={handleBackToPlayer} hitSlop={12} style={{ paddingLeft: 4 }}>
          <Ionicons name="chevron-back" size={26} color={theme.white} />
        </Pressable>
      ),
    });
  }, [navigation, returnToShowPlayer, handleBackToPlayer]);

  const [packs, setPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [packsError, setPacksError] = useState(null);
  const [selectedPack, setSelectedPack] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);

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
    setPurchaseError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setSelectedPack(null);
    setPurchaseError(null);
  };

  const onPurchase = async () => {
    if (!selectedPack?.pack_id) return;
    setPurchaseError(null);
    setPurchasing(true);
    try {
      const data = await simulatePurchase(accessToken, selectedPack.pack_id);
      if (typeof data?.coins !== 'number') {
        throw new Error('Invalid response from server');
      }
      dispatch(setCoins(data.coins));
      await authService.patchUserDataInStore({ coins: data.coins });
      setConfirmOpen(false);
      setSelectedPack(null);
      if (returnToShowPlayer) {
        handleBackToPlayer();
      } else {
        Alert.alert('Success', 'Coins have been added to your wallet.');
      }
    } catch (err) {
      setPurchaseError(
        err?.response?.data?.message || err?.message || 'Purchase failed'
      );
    } finally {
      setPurchasing(false);
    }
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
        <ActivityIndicator color={theme.crimson} style={{ marginTop: 40 }} />
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
                    {packPlanSubtitle(p, 'Simulated payment')}
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
            <Text style={styles.confirmTitle}>Confirm top-up</Text>
            {selectedPack ? (
              <View style={styles.selectedPackBox}>
                <CoinIcon size={22} color="#FFD700" />
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
  selectedPackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.deepBlack,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  selectedPackText: { color: theme.white, fontSize: 15, fontWeight: '700' },
  selectedPackSub: { color: theme.gray, fontSize: 12, marginTop: 4 },
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
