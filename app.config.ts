import type { ExpoConfig } from 'expo/config';

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY ??
  '';

const googleMapsIosApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY ??
  '';

const config: ExpoConfig = {
  name: 'Comunidade Digital',
  slug: 'app-igreja',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'appigreja',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        'Permita o acesso à câmera para leitura de QR Code no totem e registro de selfie.',
      NSFaceIDUsageDescription:
        'Permita o uso do Face ID para entrar no app de forma rápida e segura.',
      LSApplicationQueriesSchemes: ['whatsapp', 'whatsapp-api'],
    },
    config: {
      googleMapsApiKey: googleMapsIosApiKey,
      usesNonExemptEncryption: false,
    },
  },
  android: {
    queries: [{ package: 'com.whatsapp' }],
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    package: 'com.anonymous.appigreja',
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
    name: 'Comunidade Digital',
    shortName: 'Comunidade Digital',
    description: 'Acesso ao ambiente digital da sua igreja',
    lang: 'pt-BR',
    themeColor: '#0f172a',
    backgroundColor: '#020617',
    display: 'standalone',
    startUrl: '/',
    orientation: 'portrait',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Permita o acesso à câmera para leitura de QR Code no totem e registro de selfie.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Permita o acesso à galeria para anexar imagens às sugestões e melhorias.',
        microphonePermission: false,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Permita o uso do Face ID para entrar no app de forma rápida e segura.',
      },
    ],
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
        faceIDPermission:
          'Permita o uso do Face ID para entrar no app de forma rápida e segura.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Permita a localização para check-in, geolocalização de eventos e recursos que usam GPS.',
      },
    ],
    'expo-document-picker',
    'expo-font',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '28946481-fe5f-4f4b-9ae6-beab332268c8',
    },
  },
};

export default config;
