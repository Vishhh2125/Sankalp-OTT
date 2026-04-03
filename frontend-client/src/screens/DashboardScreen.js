import React, { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import { ROUTES } from '../constants/routes';
import { api } from '../services/api';
import { getErrorMessage } from '../utils/errors';

const MOCK_UPLOADS = [
  { id: '1', name: 'Breakfast Box', quantity: 5, date: 'Today' },
  { id: '2', name: 'Lunch Box', quantity: 10, date: 'Yesterday' },
];

export default function DashboardScreen({ navigation }) {
  const [uploads, setUploads] = useState(MOCK_UPLOADS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleFetchLatest() {
    setLoading(true);
    setError('');
    try {
      // Example endpoint. Replace `/foods` with your real API route.
      const response = await api.get('/foods');
      const next = response?.data?.items ?? response?.data ?? [];

      // If your API returns a different shape, adjust the mapping here.
      setUploads(Array.isArray(next) ? next : MOCK_UPLOADS);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function renderItem({ item }) {
    return (
      <AppCard style={styles.itemCard}>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.itemMeta}>Quantity: {item.quantity}</Text>
        {item.date ? <Text style={styles.itemMeta}>Date: {item.date}</Text> : null}
      </AppCard>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dashboard</Text>

      <AppCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Latest uploads</Text>
        <Text style={styles.sectionHint}>
          Click below to test the API call (replace endpoint later).
        </Text>

        <View style={styles.actionsRow}>
          <AppButton
            title={loading ? 'Loading...' : 'Load latest'}
            onPress={handleFetchLatest}
            disabled={loading}
          />
          <View style={{ width: 12 }} />
          <AppButton
            title="Upload more"
            variant="secondary"
            onPress={() => navigation.navigate(ROUTES.UPLOAD_FOOD)}
            disabled={loading}
          />
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Fetching data...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </AppCard>

      <FlatList
        data={uploads}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
      />

      <View style={{ height: 8 }} />
      <AppButton title="Back to Home" onPress={() => navigation.navigate(ROUTES.HOME)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    color: '#111827',
  },
  sectionCard: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    color: '#111827',
  },
  sectionHint: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
  errorText: {
    marginTop: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  itemCard: {},
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    color: '#111827',
  },
  itemMeta: {
    color: '#374151',
    fontSize: 13,
  },
});

