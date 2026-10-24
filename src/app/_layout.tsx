import { AppProvider, useApp } from '@/contexts/AppContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

// Ignore known upstream expo-router / useLinking dev race condition
LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
]);

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isReady, worker } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      const inAuthGroup = segments[0] === '(auth)';
      if (!worker && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (worker && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [worker, isReady, segments]);

  if (!isReady) {
    return null; // Or AnimatedSplashOverlay if available
  }

  const navLightTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: '#E0E5EC', card: '#E0E5EC' },
  };
  const navDarkTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: '#2A2D34', card: '#2A2D34' },
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? navDarkTheme : navLightTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colorScheme === 'dark' ? '#2A2D34' : '#E0E5EC' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="case" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootLayoutNav />
    </AppProvider>
  );
}

