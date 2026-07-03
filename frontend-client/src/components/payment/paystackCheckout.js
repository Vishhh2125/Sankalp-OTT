import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { theme } from '../../constants/theme';

async function loadPaystackScript() {
  if (typeof window === 'undefined') {
    throw new Error('Paystack checkout is only available in browser');
  }

  if (window.PaystackPop) {
    return window.PaystackPop;
  }

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-paystack-sdk]');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.dataset.paystackSdk = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  if (!window.PaystackPop) {
    throw new Error('Failed to load Paystack SDK');
  }

  return window.PaystackPop;
}

export async function launchPaystackCheckout({
  publicKey,
  email,
  amount,
  currency = 'NGN',
  reference,
  authorizationUrl,
  callbackUrl,
  onSuccess,
  onFailure,
}) {
  if (!publicKey) {
    throw new Error('Missing paystack public key');
  }

  if (!reference) {
    throw new Error('Missing paystack reference');
  }

  if (Platform.OS === 'web') {
    const PaystackPop = await loadPaystackScript();
    const handler = PaystackPop.setup({
      key: publicKey,
      email,
      amount: Math.round(Number(amount) * 100),
      currency,
      ref: reference,
      callback: (response) => onSuccess?.(response),
      onClose: () => onFailure?.(new Error('Payment cancelled or failed')),
    });

    handler.openIframe();
    return { method: 'web' };
  }

  if (!authorizationUrl) {
    throw new Error('Missing paystack authorization_url');
  }

  return {
    method: 'webview',
    authorizationUrl,
    callbackUrl,
    reference,
    onSuccess,
    onFailure,
  };
}

export function PaystackCheckoutModal({
  visible,
  authorizationUrl,
  callbackUrl,
  reference,
  onClose,
  onSuccess,
  onFailure,
}) {
  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);

  const finishSuccess = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    onSuccess?.({ reference });
    onClose?.();
  }, [onClose, onSuccess, reference]);

  const finishFailure = useCallback(
    (message) => {
      if (handledRef.current) return;
      handledRef.current = true;
      onFailure?.(new Error(message || 'Payment failed'));
      onClose?.();
    },
    [onClose, onFailure]
  );

  const handleMessage = useCallback(
    (event) => {
      if (handledRef.current) return;

      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'success') {
          finishSuccess();
        } else if (data.type === 'failure') {
          finishFailure(data.error);
        }
      } catch {
        // ignore malformed messages
      }
    },
    [finishFailure, finishSuccess]
  );

  const handleNavigationStateChange = useCallback(
    (navState) => {
      if (handledRef.current) return;

      const url = String(navState.url || '');
      const isPaystackPage = url.includes('paystack.com') || url.includes('checkout.paystack.com');
      if (isPaystackPage) return;

      const callbackMatch = callbackUrl ? url.startsWith(callbackUrl) : false;
      const referenceMatch = url.includes(`reference=${reference}`) || url.includes(`trxref=${reference}`);

      if (callbackMatch || referenceMatch) {
        finishSuccess();
      }
    },
    [callbackUrl, finishSuccess, reference]
  );

  if (!visible || !authorizationUrl) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={theme.crimson} />
          </View>
        ) : null}
        <WebView
          originWhitelist={['*']}
          source={{ uri: authorizationUrl }}
          onLoadEnd={() => setLoading(false)}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.deepBlack },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeText: { color: theme.white, fontSize: 16, fontWeight: '600' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  webview: { flex: 1, backgroundColor: theme.deepBlack },
});
