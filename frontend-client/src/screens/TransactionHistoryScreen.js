import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

import {
  fetchWalletTransactions,
  walletApiErrorMessage,
} from '../components/wallet/topUpApi';
import { theme } from '../constants/theme';

function formatInr(paise) {
  if (paise == null || Number.isNaN(paise)) return null;
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

function formatDateLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today - day) / (24 * 60 * 60 * 1000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function txMeta(item) {
  const isCredit = item.type?.toLowerCase() === 'credit';
  if (item.reason === 'wallet_topup_simulated') {
    return {
      icon: isCredit ? 'wallet' : 'wallet-outline',
      iconColor: '#4CD964',
      iconBg: 'rgba(76,217,100,0.15)',
    };
  }
  if (item.reason === 'episode_unlock') {
    return {
      icon: 'play-circle',
      iconColor: theme.crimson,
      iconBg: 'rgba(255,45,85,0.15)',
    };
  }
  if (item.reason === 'daily_checkin') {
    return {
      icon: 'gift',
      iconColor: '#4CD964',
      iconBg: 'rgba(76,217,100,0.15)',
    };
  }
  return {
    icon: isCredit ? 'add-circle' : 'remove-circle',
    iconColor: isCredit ? '#4CD964' : '#FF6B6B',
    iconBg: isCredit ? 'rgba(76,217,100,0.12)' : 'rgba(255,107,107,0.12)',
  };
}

function TransactionRow({ item }) {
  const isCredit = item.type?.toLowerCase() === 'credit';
  const meta = txMeta(item);
  const title = item.title || (isCredit ? 'Coins added' : 'Coins spent');
  const subtitle = item.description || item.reason || '';
  const fiat = formatInr(item.fiat_paise);
  const status = (item.status || 'completed').toLowerCase();

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: meta.iconBg }]}>
        <Ionicons name={meta.icon} size={22} color={meta.iconColor} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.amount, isCredit ? styles.amountCredit : styles.amountDebit]}>
            {isCredit ? '+' : '−'}
            {Math.abs(item.amount)}
          </Text>
        </View>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.rowFooter}>
          <Text style={styles.rowTime}>{formatTime(item.created_at)}</Text>
          {fiat ? <Text style={styles.rowFiat}>{fiat}</Text> : null}
          <View
            style={[
              styles.statusPill,
              status === 'completed' ? styles.statusDone : styles.statusPending,
            ]}
          >
            <Text style={styles.statusText}>
              {status === 'completed' ? 'Completed' : status}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function TransactionHistoryScreen() {
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) {
        setError('Please log in to view transaction history.');
        setItems([]);
        setLoading(false);
        return;
      }
      setError(null);
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await fetchWalletTransactions(accessToken, { limit: 100, offset: 0 });
        setItems(data.items || []);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          setError('Session expired. Please log in again.');
        } else if (status === 404) {
          setError(
            'Transaction API unavailable. Restart the backend (docker compose restart backend).'
          );
        } else {
          setError(walletApiErrorMessage(err, 'Failed to load transactions'));
        }
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  const sections = useMemo(() => {
    const map = new Map();
    items.forEach((tx) => {
      const label = formatDateLabel(tx.created_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(tx);
    });
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [items]);

  const flatData = useMemo(
    () =>
      sections.flatMap((s) => [
        { type: 'header', id: `h-${s.title}`, title: s.title },
        ...s.data.map((tx) => ({ type: 'tx', id: tx.id, item: tx })),
      ]),
    [sections]
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.crimson} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color={theme.gray} />
        <Text style={styles.infoText}>
          All coin top-ups and episode unlocks appear here.
        </Text>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(row) => row.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.crimson}
            />
          }
          contentContainerStyle={
            flatData.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={theme.darkGray} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySub}>
                Top up coins or unlock episodes to see your history.
              </Text>
            </View>
          }
          renderItem={({ item: row }) => {
            if (row.type === 'header') {
              return <Text style={styles.sectionHeader}>{row.title}</Text>;
            }
            return <TransactionRow item={row.item} />;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.deepBlack },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    backgroundColor: theme.surface,
    borderRadius: 10,
  },
  infoText: { flex: 1, color: theme.gray, fontSize: 12, lineHeight: 18 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1, paddingHorizontal: 16 },
  sectionHeader: {
    color: theme.gray,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowTitle: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  amount: { fontSize: 16, fontWeight: '800' },
  amountCredit: { color: '#4CD964' },
  amountDebit: { color: '#FF6B6B' },
  rowSub: { color: theme.gray, fontSize: 13, marginTop: 4, lineHeight: 18 },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  rowTime: { color: theme.darkGray, fontSize: 11 },
  rowFiat: { color: theme.gray, fontSize: 11, fontWeight: '600' },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusDone: { backgroundColor: 'rgba(76,217,100,0.15)' },
  statusPending: { backgroundColor: 'rgba(255,149,0,0.15)' },
  statusText: { color: theme.gray, fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { color: theme.white, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: {
    color: theme.gray,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorText: { color: '#ff6b6b', fontSize: 14, textAlign: 'center' },
});
