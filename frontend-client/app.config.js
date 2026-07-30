const fs = require('fs');
const path = require('path');

// Manually load .env variables prefixed with EXPO_PUBLIC_ if not already loaded (useful for EAS Build)
const loadEnv = () => {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key.startsWith('EXPO_PUBLIC_')) {
          process.env[key] = value;
        }
      }
    });
  }
};
loadEnv();

const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

const androidClientIdPrefix = androidClientId.split('.').shift() || '';
const iosClientIdPrefix = iosClientId.split('.').shift() || '';

module.exports = {
  expo: {
    name: "AlphaMinds",
    slug: "alphaminds",
    scheme: [
      "alphaminds",
      androidClientIdPrefix ? `com.googleusercontent.apps.${androidClientIdPrefix}` : null,
      iosClientIdPrefix ? `com.googleusercontent.apps.${iosClientIdPrefix}` : null
    ].filter(Boolean),
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/AlphaMinds.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/AlphaMinds.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.samyak_8505.alphaminds",
      associatedDomains: [
        "applinks:ott.ventagenie.com"
      ]
    },
    android: {
      package: "com.samyak_8505.alphaminds",
      adaptiveIcon: {
        foregroundImage: "./assets/AlphaMinds.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "INTERNET"
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "ott.ventagenie.com",
              pathPrefix: "/show"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        },
        androidClientIdPrefix ? {
          action: "VIEW",
          data: [
            {
              scheme: `com.googleusercontent.apps.${androidClientIdPrefix}`,
              path: "/oauth2redirect/google"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        } : null
      ].filter(Boolean)
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-dev-client",
      "expo-secure-store",
      "@config-plugins/react-native-blob-util",
      [
        "react-native-video",
        {
          "supportsBackgroundPlayback": true,
          "supportsPictureInPicture": true
        }
      ],
      [
        "react-native-capture-protection",
        {
          "captureType": "base"
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true
          },
          "ios": {
            "deploymentTarget": "15.1"
          }
        }
      ],
      "expo-web-browser"
    ],
    extra: {
      eas: {
        projectId: "968573ea-3b1f-42f7-a1ab-431da549d092"
      }
    },
    owner: "samyak_8505"
  }
};
