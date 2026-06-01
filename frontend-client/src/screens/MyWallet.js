import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import {
  fetchTopUpOptions,
  packPlanSubtitle,
  packPlanTitle,
  simulatePurchase,
} from '../components/wallet/topUpApi';
import CoinIcon from '../components/CoinIcon';
import { ROUTES } from '../constants/routes';
import { setCoins } from '../redux/slices/authSlice';
import * as authService from '../services/authService';

const WalletScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const coins = useSelector((s) => s.auth?.coins);

  const [listOpen, setListOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [packs, setPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [packsError, setPacksError] = useState(null);
  const [selectedPack, setSelectedPack] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);

  const displayCoins = coins ?? 0;

  const loadTopUpOptions = useCallback(async () => {
    setPacksError(null);
    setLoadingPacks(true);

    try {
      const list = await fetchTopUpOptions(accessToken);
      setPacks(Array.isArray(list) ? list : []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load top-up options';

      setPacksError(msg);
      setPacks([]);
    } finally {
      setLoadingPacks(false);
    }
  }, [accessToken]);

  const openTopUpList = () => {
    setListOpen(true);
    loadTopUpOptions();
  };

  const closeList = () => {
    setListOpen(false);
    setPacksError(null);
    setSelectedPack(null);
    setConfirmOpen(false);
    setPurchaseError(null);
  };

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

  const onSimulatePurchase = async () => {
    if (!selectedPack?.pack_id) return;

    setPurchaseError(null);
    setPurchasing(true);

    try {
      const data = await simulatePurchase(accessToken, selectedPack.pack_id);
      const next = data?.coins;

      if (typeof next !== 'number') {
        throw new Error('Invalid response from server');
      }

      dispatch(setCoins(next));
      await authService.patchUserDataInStore({ coins: next });

      setConfirmOpen(false);
      setListOpen(false);
      setSelectedPack(null);

      Alert.alert('Success', 'Coins have been added to your wallet.');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Purchase failed';

      setPurchaseError(msg);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.balanceContainer}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Coins</Text>
          <Text style={styles.balanceValue}>{String(displayCoins)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.topUpButton} onPress={openTopUpList}>
        <Text style={styles.topUpText}>Top Up</Text>
      </TouchableOpacity>

      <View style={styles.listContainer}>
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => navigation.navigate(ROUTES.TRANSACTION_HISTORY)}
        >
          <Text style={styles.listItemText}>Transaction History</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* TOP UP MODAL */}

      <Modal
        visible={listOpen}
        animationType="slide"
        transparent
        onRequestClose={closeList}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a pack</Text>

              <TouchableOpacity onPress={closeList} hitSlop={12}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingPacks ? (
              <ActivityIndicator
                color="#FF2D55"
                style={{ marginVertical: 30 }}
              />
            ) : packsError ? (
              <Text style={styles.errorText}>{packsError}</Text>
            ) : (
              <ScrollView
                style={styles.packScroll}
                showsVerticalScrollIndicator={false}
              >
                {packs.map((p, index) => (
                  <TouchableOpacity
                    key={p.pack_id}
                    style={[
                      styles.packCard,
                      index === 0 && styles.featuredPack,
                    ]}
                    activeOpacity={0.9}
                    onPress={() => onSelectPack(p)}
                  >
                    <View style={styles.packLeft}>
                      <View style={styles.coinBadge}>
                        <CoinIcon size={18} color="#FFD700" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.packTitle}>{packPlanTitle(p)}</Text>

                        <Text style={styles.packSubtitle}>
                          {packPlanSubtitle(p, 'Instant top up')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.packRight}>
                      {index === 0 && (
                        <View style={styles.popularTag}>
                          <Text style={styles.popularTagText}>
                            POPULAR
                          </Text>
                        </View>
                      )}

                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#bbb"
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* CONFIRM MODAL */}

      <Modal
        visible={confirmOpen}
        animationType="fade"
        transparent
        onRequestClose={closeConfirm}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm purchase</Text>

            {selectedPack ? (
              <View style={styles.selectedPackContainer}>
                <View style={styles.selectedPackBadge}>
                  <CoinIcon size={18} color="#FFD700" />
                </View>

                <View>
                  <Text style={styles.selectedPackText}>
                    {packPlanTitle(selectedPack)}
                  </Text>

                  <Text style={styles.selectedPackSubtext}>
                    {packPlanSubtitle(selectedPack) || 'Coins will be added instantly'}
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
                onPress={onSimulatePurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Purchase</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 20,
  },

  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },

  balanceItem: {
    alignItems: 'center',
  },

  balanceLabel: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 10,
  },

  balanceValue: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '700',
  },

  topUpButton: {
    backgroundColor: '#FF2D55',
    borderRadius: 30,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    marginHorizontal: 10,

    shadowColor: '#FF2D55',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 6,
  },

  topUpText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  listContainer: {
    marginTop: 10,
  },

  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },

  listItemText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#111',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: '72%',
    borderWidth: 1,
    borderColor: '#222',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },

  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  packScroll: {
    marginTop: 10,
  },

  packCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,

    borderWidth: 1,
    borderColor: '#2B2B2B',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  featuredPack: {
    borderColor: '#FF2D55',

    shadowColor: '#FF2D55',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 6,
  },

  packLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  coinBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,45,85,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  packTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  packSubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 4,
  },

  packRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  popularTag: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },

  popularTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginVertical: 8,
  },

  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  confirmCard: {
    backgroundColor: '#171717',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },

  confirmTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 18,
  },

  selectedPackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202020',
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
  },

  selectedPackBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,45,85,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  selectedPackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  selectedPackSubtext: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 4,
  },

  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },

  btnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },

  btnSecondaryText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },

  btnPrimary: {
    backgroundColor: '#FF2D55',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#FF2D55',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default WalletScreen;