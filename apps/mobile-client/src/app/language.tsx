import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInUp, FadeInRight, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Check, Globe2 } from 'lucide-react-native';
import i18n from '../lib/i18n';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ks', label: 'Kashmiri', native: 'کٲشُر' },
];

export default function LanguageSelection() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  
  const [selectedLang, setSelectedLang] = useState(i18n.locale.includes('hi') ? 'hi' : 'en');
  const buttonScaleRef = React.useRef(useSharedValue(1));

  // Restore persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem('aranya_language').then((saved) => {
      if (saved) {
        setSelectedLang(saved);
        i18n.locale = saved;
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    i18n.locale = selectedLang;
  }, [selectedLang]);

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScaleRef.current.value }],
  }));

  const pressButton = (isPressed: boolean) => {
    buttonScaleRef.current.value = withSpring(isPressed ? 0.95 : 1);
  };

  const handleContinue = async () => {
    // Persist language to AsyncStorage
    try {
      await AsyncStorage.setItem('aranya_language', selectedLang);
    } catch (e) {
      console.warn('Failed to persist language:', e);
    }

    // Persist language to backend DB (best-effort, non-blocking)
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (apiUrl) {
      fetch(`${apiUrl}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'anonymous_mobile_user', language: selectedLang }),
      }).catch(() => {}); // fire and forget
    }

    router.push('/onboarding');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        
        <View style={styles.header}>
          <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.iconWrapper}>
            <Globe2 size={48} color="#17c690" strokeWidth={1.5} />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(100).duration(600).springify()}>
            <Text style={styles.title}>{i18n.t('select_language', { defaultValue: 'Select Language' })}</Text>
            <Text style={styles.subtitle}>Choose your preferred language to continue.</Text>
          </Animated.View>
        </View>

        <View 
          style={styles.scrollContainer} 
        >
          <View style={styles.grid}>
            {LANGUAGES.map((lang, index) => {
              const isSelected = selectedLang === lang.code;
              return (
                <Animated.View 
                  key={lang.code} 
                  entering={FadeInUp.delay(200 + index * 40).duration(500).springify()}
                  style={styles.cardWrapper}
                >
                  <Pressable 
                    style={[styles.langCard, isSelected && styles.langCardSelected]}
                    onPress={() => setSelectedLang(lang.code)}
                  >
                    <View style={styles.langContent}>
                      <Text style={[styles.langNative, isSelected && styles.langNativeSelected]}>{lang.native}</Text>
                      <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>{lang.label}</Text>
                    </View>
                    {isSelected && (
                      <Animated.View entering={FadeInRight.duration(300)} style={styles.checkWrapper}>
                        <Check size={16} color="#ffffff" strokeWidth={3} />
                      </Animated.View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(600).duration(600).springify()} style={styles.footer}>
          <Pressable 
            onPressIn={() => pressButton(true)}
            onPressOut={() => pressButton(false)}
            onPress={handleContinue}
          >
            <Animated.View style={[styles.button, animatedButton]}>
              <Text style={styles.buttonText}>{i18n.t('continue', { defaultValue: 'Continue' })}</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
  },
  containerDesktop: {
    padding: 48,
    maxWidth: 800,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#0b3b24',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#50555c',
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  langCard: {
    height: 70,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f0f2f5',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  langCardSelected: {
    borderColor: '#17c690',
    backgroundColor: '#f0fdf4',
    shadowColor: '#17c690',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  langContent: {
    alignItems: 'center',
  },
  langNative: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#363b41',
    marginBottom: 2,
  },
  langNativeSelected: {
    color: '#0b3b24',
  },
  langLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#a8adb3',
  },
  langLabelSelected: {
    color: '#17c690',
  },
  checkWrapper: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#17c690',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  button: {
    backgroundColor: '#fc865a',
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fc865a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  }
});
