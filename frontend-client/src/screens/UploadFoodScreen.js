import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import { ROUTES } from '../constants/routes';

export default function UploadFoodScreen({ navigation }) {
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const canSubmit = useMemo(() => {
    return foodName.trim().length > 0 && quantity.trim().length > 0;
  }, [foodName, quantity]);

  async function handleUpload() {
    // Beginner-friendly placeholder. Replace with real API upload later.
    if (!canSubmit || uploading) return;

    setUploading(true);
    try {
      // simulate upload delay
      await new Promise((r) => setTimeout(r, 800));
      navigation.navigate(ROUTES.DASHBOARD);
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Text style={styles.title}>Upload Food</Text>

        <AppCard>
          <Text style={styles.label}>Food Name</Text>
          <TextInput
            value={foodName}
            onChangeText={setFoodName}
            placeholder="e.g., Lunch Box"
            style={styles.input}
            autoCapitalize="sentences"
          />

          <Text style={[styles.label, styles.mt16]}>Quantity</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g., 10"
            style={styles.input}
            keyboardType="numeric"
          />

          <Text style={[styles.label, styles.mt16]}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any details for delivery / packing"
            style={[styles.input, styles.textArea]}
            multiline
          />

          <View style={styles.actions}>
            <AppButton
              title={uploading ? 'Uploading...' : 'Upload'}
              disabled={!canSubmit || uploading}
              onPress={handleUpload}
            />

            <View style={{ height: 12 }} />

            <AppButton
              title="Back to Home"
              variant="secondary"
              disabled={uploading}
              onPress={() => navigation.navigate(ROUTES.HOME)}
            />
          </View>
        </AppCard>
      </KeyboardAvoidingView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
  },
  inner: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    fontWeight: '600',
  },
  mt16: {
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: 20,
  },
});

