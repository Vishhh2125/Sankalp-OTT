import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Modal, View, ActivityIndicator, StyleSheet, Pressable, Text } from 'react-native';
import React, { useCallback, useRef, useState } from 'react';
import { theme } from '../../constants/theme';

/**
 * Launch Cashfree hosted checkout using payment_session_id.
 * - Web: loads Cashfree JS SDK directly
 * - Native: opens WebView modal with embedded checkout
 */
export async function launchCashfreeCheckout({
  paymentSessionId,
  orderId,
  mode = 'sandbox',
  onSuccess,
  onFailure,
}) {
  if (!paymentSessionId) {
    throw new Error('Missing payment_session_id');
  }

  if (Platform.OS === 'web') {
    await launchWebCheckout({ paymentSessionId, mode, onSuccess, onFailure });
    return { method: 'web' };
  }

  return {
    method: 'webview',
    paymentSessionId,
    orderId,
    mode,
    onSuccess,
    onFailure,
  };
}

async function loadCashfreeScript() {
  if (typeof window === 'undefined') {
    throw new Error('Cashfree checkout is only available in browser');
  }

  if (window.Cashfree) {
    return window.Cashfree;
  }

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cashfree-sdk]');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.dataset.cashfreeSdk = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  if (!window.Cashfree) {
    throw new Error('Failed to load Cashfree SDK');
  }

  return window.Cashfree;
}

async function launchWebCheckout({ paymentSessionId, mode, onSuccess, onFailure }) {
  const Cashfree = await loadCashfreeScript();
  const cashfree = Cashfree({ mode: mode === 'production' ? 'production' : 'sandbox' });

  try {
    const result = await cashfree.checkout({
      paymentSessionId,
      redirectTarget: '_modal',
    });

    if (result?.error) {
      onFailure?.(result.error);
      return;
    }

    onSuccess?.(result);
  } catch (err) {
    onFailure?.(err);
  }
}

function buildCheckoutHtml(paymentSessionId, mode) {
  const safeSession = String(paymentSessionId).replace(/'/g, "\\'");
  const safeMode = mode === 'production' ? 'production' : 'sandbox';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <style>
    body { margin: 0; font-family: -apple-system, sans-serif; background: #0d0010; color: #fff; }
    .wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .msg { font-size: 14px; opacity: 0.8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="msg">Opening secure payment…</p>
  </div>
  <script>
    (function () {
      var sessionId = '${safeSession}';
      var mode = '${safeMode}';
      try {
        var cashfree = Cashfree({ mode: mode });
        cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: '_self'
        }).then(function (result) {
          if (result && result.error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failure', error: result.error }));
          }
          // Do not post success message here, because the page will redirect to the return_url,
          // which is intercepted on the native side via onNavigationStateChange.
        }).catch(function (err) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failure', error: String(err && err.message || err) }));
        });
      } catch (e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failure', error: String(e.message || e) }));
      }
    })();
  </script>
</body>
</html>`;
}

export function CashfreeCheckoutModal({
  visible,
  paymentSessionId,
  mode = 'sandbox',
  onClose,
  onSuccess,
  onFailure,
}) {
  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);

  const handleMessage = useCallback(
    (event) => {
      if (handledRef.current) return;

      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'success') {
          handledRef.current = true;
          onSuccess?.(data.result);
          onClose?.();
        } else if (data.type === 'failure') {
          handledRef.current = true;
          onFailure?.(new Error(data.error || 'Payment failed'));
          onClose?.();
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onClose, onFailure, onSuccess]
  );

  const handleNavigationStateChange = useCallback(
    (navState) => {
      if (handledRef.current) return;

      const url = String(navState.url || '');
      
      // Do not intercept if it is the active payment gateway checkout page
      const isPaymentPage = url.includes('/pg/') || url.includes('/checkout');
      if (isPaymentPage) return;

      // Intercept return redirection matching return URL host or common parameters
      const isReturn =
        url.includes('sandbox.cashfree.com') ||
        url.includes('/payments/verify-order') ||
        url.includes('/payment-return') ||
        url.includes('order_id=');

      if (isReturn) {
        handledRef.current = true;
        onSuccess?.();
        onClose?.();
      }
    },
    [onClose, onSuccess]
  );

  if (!visible || !paymentSessionId) {
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
          source={{ html: buildCheckoutHtml(paymentSessionId, mode) }}
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
