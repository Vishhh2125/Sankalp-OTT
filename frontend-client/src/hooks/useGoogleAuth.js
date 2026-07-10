import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { googleLogin } from '../redux/slices/authSlice';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const dispatch = useDispatch();
  const [googleError, setGoogleError] = useState(null);

  // androidClientId uses the custom URI scheme flow:
  // com.googleusercontent.apps.982027727139-urdpt7ckau4iv14ahmvm17augrgjeit6:/oauth2redirect/google
  // This requires "Enable custom URI scheme" to be checked in Google Cloud Console
  // under the Android OAuth client's Advanced Settings.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: AuthSession.makeRedirectUri({
      native: 'com.googleusercontent.apps.982027727139-urdpt7ckau4iv14ahmvm17augrgjeit6:/oauth2redirect/google',
    }),
  });

  useEffect(() => {
    const redirectUri = AuthSession.makeRedirectUri({
      native: 'com.googleusercontent.apps.982027727139-urdpt7ckau4iv14ahmvm17augrgjeit6:/oauth2redirect/google',
    });
    console.log('[GoogleAuth] redirectUri:', redirectUri);
    console.log('[GoogleAuth] Android Client ID:', process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
    console.log('[GoogleAuth] Web Client ID:', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      setGoogleError(null);
      // Log the FULL response to see exactly what Google returned
      console.log('[GoogleAuth] FULL response.params:', JSON.stringify(response.params));
      console.log('[GoogleAuth] FULL response.authentication:', JSON.stringify(response.authentication));
      const idToken = response.params.id_token || response.authentication?.idToken;
      console.log('[GoogleAuth] id_token present:', !!idToken);
      console.log('[GoogleAuth] id_token value (first 30 chars):', idToken ? idToken.substring(0, 30) : 'MISSING');
      if (!idToken) {
        setGoogleError('Google sign-in failed. No token received.');
        return;
      }
      dispatch(googleLogin({ idToken }));
    } else if (response?.type === 'error') {
      console.log('[GoogleAuth] error:', JSON.stringify(response.error));
      console.log('[GoogleAuth] error params:', JSON.stringify(response.params));
      setGoogleError(
        response?.error?.message ||
        response?.params?.error_description ||
        'Google sign-in failed. Please try again.'
      );
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      console.log('[GoogleAuth] user dismissed/cancelled');
    }
  }, [response, dispatch]);

  return { promptAsync, loading: !request, googleError };
}
