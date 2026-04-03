import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import { ROUTES } from '../constants/routes';

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sankalp OTT</Text>

      <AppCard style={styles.card}>
        <Text style={styles.subtitle}>Choose what you want to do</Text>
        <View style={styles.actions}>
          <AppButton
            title="Upload Food"
            onPress={() => navigation.navigate(ROUTES.UPLOAD_FOOD)}
          />
          <View style={{ height: 10 }} />
          <AppButton
            title="Go to Dashboard"
            variant="secondary"
            onPress={() => navigation.navigate(ROUTES.DASHBOARD)}
          />
        </View>
      </AppCard>

      <Text style={styles.helper}>
        Tip: This is a starter UI. Connect your API calls inside screens
        later.
      </Text>
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
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 16,
    color: '#111827',
  },
  card: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  actions: {
    marginTop: 6,
  },
  helper: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
});

