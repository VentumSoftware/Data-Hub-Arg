# Mobile App Development Guide

## Overview

The mobile package is a React Native app built with Expo, providing cross-platform support for iOS, Android, and Web from a single codebase.

## How Expo Works

**Expo** is a framework and platform for universal React applications. It provides:

1. **Managed Workflow** - No need to touch native code (Swift/Objective-C/Java/Kotlin)
2. **Development Tools** - Hot reload, debugging, and development builds
3. **Native APIs** - Camera, location, notifications, etc. via JavaScript
4. **Build Service** - Cloud builds without Mac for iOS (EAS Build)
5. **OTA Updates** - Push JavaScript updates without app store review

## Architecture

```
packages/mobile/
├── App.tsx                 # Main entry point
├── app.json               # Expo configuration
├── eas.json              # EAS Build configuration (created on setup)
├── src/
│   ├── components/       # Reusable components
│   ├── screens/          # Screen components
│   ├── navigation/       # Navigation setup
│   ├── services/         # API services
│   ├── store/           # Redux store
│   └── utils/           # Utilities
├── assets/              # Images, fonts, etc.
└── .easignore          # Files to ignore in EAS builds

```

## Development Workflow

### 1. Local Development

```bash
# Start development server
cd packages/mobile
npm run start

# Run on specific platform
npm run ios       # iOS Simulator (Mac only)
npm run android   # Android Emulator
npm run web      # Web browser
```

### 2. Development Options

When you run `npm run start`, Expo gives you options:
- Press `i` for iOS simulator
- Press `a` for Android emulator  
- Press `w` for web browser
- Scan QR code with Expo Go app on your phone

### 3. Using Expo Go App

1. Install **Expo Go** from App Store/Play Store
2. Run `npm run start` in the project
3. Scan the QR code with:
   - iOS: Camera app
   - Android: Expo Go app
4. App loads on your phone with hot reload!

## OTA Updates (Over-The-Air)

### What are OTA Updates?

OTA updates let you push JavaScript/asset updates to users instantly without going through app store review. This works because React Native apps have:
- **Native shell** (binary) - Requires app store update
- **JavaScript bundle** - Can be updated OTA

### Setting Up OTA Updates

1. **Install EAS CLI**
```bash
npm install -g eas-cli
eas login  # Login with Expo account
```

2. **Configure project** (automatically done by setup-project.js)
```bash
cd packages/mobile
eas build:configure  # Creates eas.json if not exists
```

3. **Publish an update**
```bash
# Publish to production channel
eas update --branch production --message "Bug fixes"

# Publish to preview channel  
eas update --branch preview --message "New features"

# Publish to development channel
eas update --branch development --message "Testing"
```

### How Updates Work

1. App checks for updates on launch (configurable)
2. Downloads new JavaScript bundle if available
3. Applies update on next app restart
4. Falls back to previous version if update fails

### Update Channels

Channels let you have different update streams:
- `development` - Internal testing
- `preview` - Beta testing
- `production` - Live users

Configure in `eas.json`:
```json
{
  "build": {
    "production": {
      "channel": "production"
    },
    "preview": {
      "channel": "preview"
    }
  }
}
```

## Building for Production

### 1. EAS Build (Recommended)

**No Mac required for iOS builds!**

```bash
# Configure build (first time only)
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both
eas build --platform all
```

### 2. Build Types

#### Development Build
- Includes developer tools
- Can load from Metro bundler
- For testing on real devices

```bash
eas build --profile development
```

#### Preview Build
- Production-like build
- For internal testing/QA
- Can use OTA updates

```bash
eas build --profile preview
```

#### Production Build
- Optimized for app stores
- Ready for submission
- OTA updates enabled

```bash
eas build --profile production
```

## App Store Submission

### Automatic Submission (via EAS)

1. **Configure credentials** in `eas.json` (done by setup script)
2. **Submit to stores**:

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

### Manual Submission

1. Download build from EAS
2. Upload via:
   - iOS: Transporter app or Xcode
   - Android: Google Play Console

## API Integration

### Connect to Backend

```typescript
// src/services/api.ts
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export default api;
```

### Environment Variables

Use `expo-constants` to access environment-specific values:

```typescript
// app.json
{
  "expo": {
    "extra": {
      "apiUrl": process.env.EXPO_PUBLIC_API_URL
    }
  }
}

// In your code
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

## Authentication

### Example OAuth Flow

```typescript
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

const useAuth = () => {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: 'your-client-id',
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: AuthSession.makeRedirectUri(),
    },
    { authorizationEndpoint: 'https://your-api.com/oauth/authorize' }
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      // Exchange code for tokens
    }
  }, [response]);

  return { promptAsync };
};
```

## Push Notifications

### Setup

```typescript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  // Send token to your backend
  return token;
}
```

## State Management

The mobile app uses Redux Toolkit (same as frontend):

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
```

## Testing

### Local Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

### Device Testing

1. **iOS TestFlight**
   - Build with `eas build --profile preview`
   - Upload to TestFlight
   - Invite testers

2. **Android Internal Testing**
   - Build with `eas build --profile preview`
   - Upload to Play Console
   - Share testing link

## Performance Optimization

### 1. Image Optimization
```typescript
import { Image } from 'react-native';
import FastImage from 'react-native-fast-image';

// Use FastImage for better performance
<FastImage
  source={{ uri: imageUrl }}
  style={styles.image}
  resizeMode={FastImage.resizeMode.cover}
/>
```

### 2. List Optimization
```typescript
import { FlatList } from 'react-native';

<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
/>
```

### 3. Memo and Callbacks
```typescript
import React, { memo, useCallback } from 'react';

const ExpensiveComponent = memo(({ data, onPress }) => {
  return <View>...</View>;
});
```

## Common Commands

```bash
# Development
npm run start            # Start Expo dev server
npm run ios             # Run on iOS simulator
npm run android         # Run on Android emulator
npm run web            # Run in web browser

# Building
eas build --platform ios              # Build iOS
eas build --platform android          # Build Android
eas build --profile preview          # Build preview version

# Updates
eas update --branch production       # Push OTA update
eas update --branch preview         # Push to preview channel

# Submission
eas submit --platform ios           # Submit to App Store
eas submit --platform android       # Submit to Google Play
```

## Troubleshooting

### Expo Go Connection Issues
- Ensure phone and computer are on same network
- Try using tunnel: `expo start --tunnel`
- Check firewall settings

### Build Failures
- Clear cache: `expo start -c`
- Check eas.json configuration
- Verify credentials in Expo dashboard

### OTA Updates Not Working
- Check update channel matches build
- Verify internet connection
- Look at update manifest: `eas update:list`

## Cost Considerations

### Expo/EAS Pricing
- **Free tier**: 30 builds/month
- **Priority**: $29/month for faster builds
- **Production**: $99/month for teams

### OTA Updates
- **Free**: Unlimited OTA updates
- Only pay for builds, not updates!

## Next Steps

1. **Set up deep linking** for navigation from external apps
2. **Implement offline support** with Redux Persist
3. **Add crash reporting** with Sentry
4. **Set up analytics** with Amplitude or Mixpanel
5. **Configure push notifications** with your backend

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [React Native Docs](https://reactnative.dev)