import 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { getFirebaseAuth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.log('Splash screen prevent hide failed:', e);
}

export default function Layout() {
  const router = useRouter();
  const segments = useSegments();
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Handle auto-login redirect
  useEffect(() => {
    if (!loaded) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If user is logged in and not already on the dashboard, auto-redirect to dashboard
        const currentSegment = segments[0];
        if (currentSegment !== 'dashboard') {
          router.replace('/dashboard');
        }
      }
    });

    return () => unsubscribe();
  }, [loaded, segments]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </SafeAreaProvider>
  );
}
