# 🔐 Google OAuth Setup Guide — Sankalp OTT (Expo / React Native)

> This guide documents every step required to configure Google Sign-In for this project.
> It captures real-world gotchas so the next developer doesn't repeat the same pain.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1 — Create the Google Cloud Project](#step-1--create-the-google-cloud-project)
3. [Step 2 — Enable Required APIs](#step-2--enable-required-apis)
4. [Step 3 — Configure the OAuth Consent Screen](#step-3--configure-the-oauth-consent-screen)
5. [Step 4 — Create the 3 OAuth Clients](#step-4--create-the-3-oauth-clients)
6. [⚠️ CRITICAL — Enable Custom URI Scheme (Android)](#️-critical--enable-custom-uri-scheme-android)
7. [Step 5 — Update Frontend `.env`](#step-5--update-frontend-env)
8. [Step 6 — Update Backend `.env`](#step-6--update-backend-env)
9. [Step 7 — Verify `app.json` Configuration](#step-7--verify-appjson-configuration)
10. [Step 8 — Rebuild the App](#step-8--rebuild-the-app)
11. [How the Auth Flow Works](#how-the-auth-flow-works)
12. [Common Errors & Fixes](#common-errors--fixes)

---

## Prerequisites

| Requirement | Detail |
|---|---|
| Google account | Access to [console.cloud.google.com](https://console.cloud.google.com) |
| EAS CLI | `npm install -g eas-cli` |
| EAS project linked | `eas init` already run — `projectId` exists in `app.json` |
| Expo slug & owner | Check your `app.json` → `expo.slug` and `expo.owner` |
| Android package name | Check your `app.json` → `expo.android.package` |
| iOS bundle identifier | Check your `app.json` → `expo.ios.bundleIdentifier` |

---

## Step 1 — Create the Google Cloud Project

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com).
2. Click the **project dropdown** at the top-left → **New Project**.
3. Give it a name (e.g., `My OTT App`) → Click **Create**.
4. Make sure this new project is selected in the dropdown before continuing.

---

## Step 2 — Enable Required APIs

1. Left sidebar → **APIs & Services → Library**.
2. Search and enable **"Google Identity Toolkit API"**.
3. Search and enable **"People API"** (needed for profile info — `name`, `picture`).

---

## Step 3 — Configure the OAuth Consent Screen

You must do this **before** creating any Client IDs.

1. Left sidebar → **APIs & Services → OAuth consent screen**.
2. Choose **External** → Click **Create**.
3. Fill in:
   - **App name**: your app's name
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue** through the Scopes step (no extra scopes needed).
5. On the **Test users** screen, add your own Gmail address.
6. Click **Back to Dashboard**.

> **Note**: While in "Testing" mode, only Test Users can sign in. To allow anyone, you must publish the app (requires Google verification — not needed for development).

---

## Step 4 — Create the 3 OAuth Clients

Go to **APIs & Services → Credentials** → click **`+ CREATE CREDENTIALS → OAuth client ID`**.

Repeat this **3 times** — once for each platform below.

---

### 4a — Web Client

> The Web Client is the most critical. It is what produces the `id_token` used by both Android and the backend.

| Field | Value |
|---|---|
| **Application type** | `Web application` |
| **Name** | `Web Client` |
| **Authorized JavaScript origins** | `https://auth.expo.io` |
| **Authorized redirect URIs** | `https://auth.expo.io/@<your-expo-owner>/<your-expo-slug>` |

- Replace `<your-expo-owner>` with the value of `expo.owner` from your `app.json`.
- Replace `<your-expo-slug>` with the value of `expo.slug` from your `app.json`.

Click **Create** → copy the **Client ID** from the popup.

---

### 4b — Android Client

| Field | Value |
|---|---|
| **Application type** | `Android` |
| **Name** | `Android Client` |
| **Package name** | value of `expo.android.package` from your `app.json` |
| **SHA-1 certificate fingerprint** | see below ↓ |

#### Getting the SHA-1 Fingerprint

Open a terminal at the project root and run:

```bash
eas credentials
```

Navigate: **Android → your build profile (e.g. `development`) → Keystore → View keystore details**

Copy the **SHA-1** value (looks like `AB:CD:EF:12:34:56:...`).

> ⚠️ You need a separate SHA-1 for each build profile (development vs production). Use the **development** keystore fingerprint for dev builds.

Click **Create** → copy the **Client ID**.

---

### 4c — iOS Client

| Field | Value |
|---|---|
| **Application type** | `iOS` |
| **Name** | `iOS Client` |
| **Bundle ID** | value of `expo.ios.bundleIdentifier` from your `app.json` |
| **App Store ID** | leave blank |
| **Team ID** | leave blank |

Click **Create** → copy the **Client ID**.

---

## ⚠️ CRITICAL — Enable Custom URI Scheme (Android)

> **This is the most commonly missed step. Without it, Android OAuth silently fails with a `redirect_uri_mismatch` or `invalid_request` error and no useful message.**

### Why This Is Needed

This project uses a **native custom URI scheme** for the Android OAuth redirect callback:

```
com.googleusercontent.apps.<your-android-client-id>:/oauth2redirect/google
```

This URI is derived by **reversing** your Android Client ID. It is not an `https://` URL, so Google blocks it by default. You must explicitly enable it.

### How to Enable It

1. Go to **APIs & Services → Credentials**.
2. Click on your **Android OAuth 2.0 Client** (created in Step 4b).
3. Scroll to the very bottom of the page.
4. Expand the **"Advanced settings"** section.
5. Find the toggle/checkbox:

   > **☑️ Enable custom URI scheme**

6. **Turn it ON.**
7. Click **Save**.

### Where It Is in the Console

```
Google Cloud Console
  → APIs & Services
    → Credentials
      → [click your Android OAuth Client]
        → scroll to bottom
          → Advanced settings
            → ☑️ Enable custom URI scheme   ← enable this
```

### What Happens Without It

| Error Seen | Root Cause |
|---|---|
| `Error 400: redirect_uri_mismatch` | Google rejected the custom scheme redirect |
| `Error 400: invalid_request` | Same root cause |
| Browser popup closes immediately with error | Same root cause |
| `Google sign-in failed. No token received.` | OAuth never completed |

### How It Works in Code

In `frontend-client/src/hooks/useGoogleAuth.js`:

```js
WebBrowser.maybeCompleteAuthSession(); // ← must be at top-level, outside all functions

const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  redirectUri: AuthSession.makeRedirectUri({
    native: 'com.googleusercontent.apps.<your-android-client-id>:/oauth2redirect/google',
  }),
});
```

The `native:` value is always the **reversed Android Client ID** followed by `:/oauth2redirect/google`:

```
com.googleusercontent.apps.<your-android-client-id>:/oauth2redirect/google
```

Example — if your Android Client ID is `123456789-abcdefgh.apps.googleusercontent.com`, then:
```
com.googleusercontent.apps.123456789-abcdefgh:/oauth2redirect/google
```

---

## Step 5 — Update Frontend `.env`

Copy `frontend-client/.env.example` to `frontend-client/.env` and fill in the values:

```env
# ─── API ──────────────────────────────────────────────────────────
EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:8080

# ─── Google OAuth Client IDs ──────────────────────────────────────
# Web Client — used to receive id_token on Android & iOS
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-web-client-id>.apps.googleusercontent.com

# Android Client — must have "Enable custom URI scheme" ON (see above)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<your-android-client-id>.apps.googleusercontent.com

# iOS Client
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>.apps.googleusercontent.com
```

> ⚠️ Never commit `.env` to Git. Confirm it is listed in `.gitignore`.

---

## Step 6 — Update Backend `.env`

The backend also needs Google Client IDs to **verify the `id_token`** it receives from the app.
It uses the `google-auth-library` package and calls `verifyIdToken()` — which checks that the token's audience (`aud` claim) matches one of your registered Client IDs.

Copy `backend/.env.example` to `backend/.env` (or `backend/.env.docker`) and add:

```env
# ─── Google OAuth — backend token verification ────────────────────
# Primary audience: use your Web Client ID
GOOGLE_CLIENT_ID=<your-web-client-id>.apps.googleusercontent.com

# Secondary audience: Android tokens may carry the Android Client ID as 'aud'
GOOGLE_ANDROID_CLIENT_ID=<your-android-client-id>.apps.googleusercontent.com
```

> **Why two IDs?** Depending on the OAuth flow, Google may issue the `id_token` with either the Web Client ID or the Android Client ID as the `aud` claim. The backend accepts both. If only `GOOGLE_CLIENT_ID` is set, Android logins may fail with an **"Invalid audience"** error.

> ⚠️ Use the variable names `GOOGLE_CLIENT_ID` and `GOOGLE_ANDROID_CLIENT_ID` — **not** the `EXPO_PUBLIC_` prefixed names (those are frontend-only).

---

## Step 7 — Verify `app.json` Configuration

`app.json` must register the reversed Android Client ID as a URI scheme so the Android OS can route the OAuth callback back into the app.

Open `frontend-client/app.json` and verify these two sections exist:

### `scheme` — registers the URI scheme at the system level

```json
"scheme": [
  "<your-app-slug>",
  "com.googleusercontent.apps.<your-android-client-id>"
]
```

### `android.intentFilters` — intercepts the OAuth callback deep link

```json
{
  "action": "VIEW",
  "data": [
    {
      "scheme": "com.googleusercontent.apps.<your-android-client-id>",
      "path": "/oauth2redirect/google"
    }
  ],
  "category": ["BROWSABLE", "DEFAULT"]
}
```

Replace `<your-android-client-id>` with the prefix of your Android Client ID (everything before `.apps.googleusercontent.com`).

Example — if Android Client ID is `123456789-abcdefgh.apps.googleusercontent.com`:
```json
"scheme": "com.googleusercontent.apps.123456789-abcdefgh"
```

> If these are missing or the scheme doesn't match exactly, the OAuth browser opens but the callback never returns to the app.

---

## Step 8 — Rebuild the App

Changes to `app.json` require a **full native rebuild** — hot reload and `expo start` alone are not enough.

### Local dev build (physical device / emulator)

```bash
cd frontend-client
npx expo run:android
```

### EAS cloud build

```bash
eas build --profile development --platform android
```

### If you only changed `.env` (no `app.json` changes)

```bash
npx expo start --clear
```

> `--clear` flushes the Metro cache so updated env values are picked up immediately.

---

## How the Auth Flow Works

```
User taps "Sign in with Google"
        │
        ▼
useGoogleAuth.promptAsync()
        │
        ▼
Expo opens system WebBrowser → Google's OAuth consent page
  (using androidClientId + webClientId + native redirectUri)
        │
        ▼
User approves
        │
        ▼
Google redirects to:
  com.googleusercontent.apps.<android-client-id>:/oauth2redirect/google?id_token=...
        │
        ▼
Android OS intercepts the custom URI scheme
  (registered via app.json → scheme + intentFilters)
        │
        ▼
WebBrowser.maybeCompleteAuthSession() closes the browser
        │
        ▼
App receives id_token from response.params.id_token
        │
        ▼
Frontend sends id_token to backend:
  POST /api/v1/auth/google   { idToken: "eyJ..." }
        │
        ▼
Backend calls googleClient.verifyIdToken()
  → Checks audience against GOOGLE_CLIENT_ID + GOOGLE_ANDROID_CLIENT_ID
  → Extracts email, name, picture from payload
  → Upserts user in DB
  → Returns JWT access + refresh tokens
        │
        ▼
App stores tokens in SecureStore → User is logged in ✅
```

---

## Common Errors & Fixes

| Error / Symptom | Likely Cause | Fix |
|---|---|---|
| `Error 400: redirect_uri_mismatch` | Custom URI scheme not enabled | Android OAuth client → Advanced Settings → **Enable custom URI scheme** ✅ |
| `Error 400: invalid_request` | Same as above | Same fix |
| Browser popup closes immediately with error page | Same as above | Same fix |
| `No id_token received` / `MISSING` | Wrong `webClientId` | Verify `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in frontend `.env` |
| `Google sign-in failed. No token received.` | id_token absent | Check Expo console logs for actual Google error |
| Auth browser never closes / hangs | `maybeCompleteAuthSession()` called inside a component or hook body | Move it to the **top level** of the file, outside all functions |
| Works in Expo Go but not in dev build | SHA-1 mismatch | Run `eas credentials` → get SHA-1 from the **development** keystore → update Android client |
| `Invalid audience` error on backend | Backend missing `GOOGLE_ANDROID_CLIENT_ID` | Add `GOOGLE_ANDROID_CLIENT_ID` to backend `.env` |
| OAuth screen shows "App not verified" | Consent screen in Testing mode | Add your Gmail as a Test User in the OAuth consent screen |
| Callback never returns to app | `scheme` or `intentFilters` missing in `app.json` | Add reversed Client ID to both sections → **rebuild** |
| Old Client IDs still used after `.env` change | Metro cache stale | Run `npx expo start --clear` |

---

*Last updated: July 2026 · Maintained by the Sankalp-Edutech team*
