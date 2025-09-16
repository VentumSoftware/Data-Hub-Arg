# Ventum Mobile App

React Native mobile application for the Ventum Framework using Expo.

## Features

- 📱 Cross-platform (iOS, Android, Web)
- 🔐 Google OAuth authentication
- 🔄 Redux state management
- 🎨 Native UI components
- 🔒 Secure token storage
- 📡 API integration with backend

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- For iOS development: Xcode (macOS only)
- For Android development: Android Studio

## Getting Started

### 1. Install Dependencies

From the project root:
```bash
npm install
```

### 2. Configure Environment

Create `.env` file in the mobile package:
```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### 3. Start Development Server

```bash
# From project root
npm run mobile:start

# Or from mobile package
cd packages/mobile
npm run start
```

### 4. Run on Devices/Simulators

```bash
# iOS Simulator (macOS only)
npm run mobile:ios

# Android Emulator
npm run mobile:android

# Web Browser
npm run mobile:web
```

## Development

### Project Structure

```
mobile/
├── src/
│   ├── screens/        # Screen components
│   ├── components/     # Reusable components
│   ├── navigation/     # Navigation configuration
│   ├── store/          # Redux store and slices
│   ├── services/       # API services
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript types
├── assets/             # Images, fonts, etc.
├── App.tsx             # Root component
└── app.json            # Expo configuration
```

### Key Technologies

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and tools
- **Redux Toolkit** - State management
- **React Navigation** - Navigation library
- **Axios** - HTTP client
- **Expo SecureStore** - Secure storage for tokens

### Authentication Flow

1. User opens app → Check for stored token
2. If no token → Show login screen
3. Login with email/password or Google OAuth
4. Store token securely
5. Navigate to home screen
6. Token included in all API requests

### Available Screens

- **LoginScreen** - Email/password and Google OAuth login
- **HomeScreen** - Dashboard with feature cards
- **ProfileScreen** - User profile information

## Building for Production

### Using Expo Build Service (EAS)

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Configure your project:
```bash
eas build:configure
```

3. Build for iOS:
```bash
npm run build:ios
```

4. Build for Android:
```bash
npm run build:android
```

### Local Builds

For iOS (macOS only):
```bash
expo run:ios --configuration Release
```

For Android:
```bash
expo run:android --variant Release
```

## Testing

Run tests:
```bash
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| EXPO_PUBLIC_API_URL | Backend API URL | http://localhost:3000 |
| EXPO_PUBLIC_GOOGLE_CLIENT_ID | Google OAuth Client ID | - |

## Troubleshooting

### Metro bundler issues
```bash
# Clear cache
expo start -c
```

### iOS build issues
```bash
# Clean and rebuild
cd ios && pod install
```

### Android build issues
```bash
# Clean build
cd android && ./gradlew clean
```

## Tips

- Use `expo-dev-client` for custom native modules
- Test on real devices for accurate performance
- Use React Native Debugger for better debugging
- Enable Hermes for better Android performance

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [React Navigation](https://reactnavigation.org)
- [Redux Toolkit](https://redux-toolkit.js.org)