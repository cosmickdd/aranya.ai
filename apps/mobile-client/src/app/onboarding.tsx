import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInRight, FadeOutLeft, FadeInUp, withSpring, useAnimatedStyle, useSharedValue, FadeInDown } from 'react-native-reanimated';
import i18n from '../lib/i18n';
import { Check } from 'lucide-react-native';

const ONBOARDING_STEPS = [
  {
    titleKey: 'onboarding_1_title',
    subtitleKey: 'onboarding_1_subtitle',
    image: require('../../assets/images/onboarding1.png'),
  },
  {
    titleKey: 'onboarding_2_title', 
    titleFallback: 'Modern Farming',
    subtitleFallback: 'Discover a better way for Modern Farmer. Connect with markets and weather in real time.',
    image: require('../../assets/images/onboarding2.png'),
  },
  {
    titleKey: 'onboarding_3_title',
    titleFallback: 'Grow Together',
    subtitleFallback: 'Join the community of thousands of farmers across the country and grow your yield.',
    image: require('../../assets/images/onboarding3.png'),
  },
  {
    titleKey: 'onboarding_4_title',
    titleFallback: 'Tell Aranya About You',
    subtitleFallback: 'Aranya remembers your details so you never have to repeat yourself.',
    image: null,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState('');
  const [crops, setCrops] = useState('');
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const isLastStep = step === ONBOARDING_STEPS.length - 1;
  const isProfileStep = isLastStep;
  const buttonScaleRef = React.useRef(useSharedValue(1));

  const handleNext = async () => {
    if (!isLastStep) {
      setStep(step + 1);
      return;
    }

    setSaving(true);
    try {
      if (location) await AsyncStorage.setItem('aranya_location', location);
      if (crops) await AsyncStorage.setItem('aranya_crops', crops);

      const userId = await AsyncStorage.getItem('aranya_user_id') || 'anonymous_mobile_user';
      const lang = await AsyncStorage.getItem('aranya_language') || 'hi';

      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (apiUrl) {
        await fetch(`${apiUrl}/api/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            language: lang,
            location: location.trim() || undefined,
            crops: crops.trim() || undefined,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Profile save failed:', e);
    } finally {
      setSaving(false);
      router.push('/sign-in');
    }
  };

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScaleRef.current.value }],
  }));

  const pressButton = (isPressed: boolean) => {
    buttonScaleRef.current.value = withSpring(isPressed ? 0.95 : 1);
  };

  const currentStep = ONBOARDING_STEPS[step];
  const title = i18n.t(currentStep.titleKey, { defaultValue: (currentStep.titleFallback || currentStep.titleKey) as string });
  const subtitle = i18n.t(currentStep.subtitleKey || '', { defaultValue: (currentStep.subtitleFallback || '') as string });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        {/* Illustration — hidden on profile step */}
        <View style={[styles.illustrationSection, !currentStep.image && styles.profileIllustration, isDesktop && styles.illustrationSectionDesktop]}>
          {currentStep.image ? (
            <Animated.View key={step} entering={FadeInUp.duration(800).springify()} style={styles.imageWrapper}>
              <Image source={currentStep.image} style={styles.illustration} contentFit="cover" />
            </Animated.View>
          ) : (
            <Animated.Text entering={FadeInUp.duration(600).springify()} style={styles.profileEmoji}>
              🌾
            </Animated.Text>
          )}
        </View>

        {/* Content */}
        <View style={[styles.contentSection, isDesktop && styles.contentSectionDesktop]}>
          <View style={styles.contentInner}>
            <Animated.View
              key={step}
              entering={FadeInRight.duration(500).springify()}
              exiting={FadeOutLeft.duration(300)}
              style={styles.textContent}
            >
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

              {/* Profile inputs — only on final slide */}
              {isProfileStep && (
                <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>📍 Aapka gaon / shahar</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Varanasi, Nashik, Ludhiana"
                    placeholderTextColor="#b0b5bc"
                    value={location}
                    onChangeText={setLocation}
                    returnKeyType="next"
                  />
                  <Text style={styles.inputLabel}>🌾 Aap kya ugaate hain?</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Wheat, Onion, Rice"
                    placeholderTextColor="#b0b5bc"
                    value={crops}
                    onChangeText={setCrops}
                    returnKeyType="done"
                  />
                  <Text style={styles.skipHint}>(Optional — you can skip for now)</Text>
                </Animated.View>
              )}
            </Animated.View>

            <View style={styles.footer}>
              <View style={styles.pagination}>
                {ONBOARDING_STEPS.map((_, index) => {
                  const isActive = index === step;
                  return (
                    <View key={index} style={[styles.dot, isActive ? styles.dotActive : null]}>
                      {isActive && <View style={styles.dotActiveInner} />}
                    </View>
                  );
                })}
              </View>

              <Pressable
                style={styles.buttonWrapper}
                onPressIn={() => pressButton(true)}
                onPressOut={() => pressButton(false)}
                onPress={handleNext}
                disabled={saving}
              >
                <Animated.View style={[styles.button, animatedButton]}>
                  <Text style={styles.buttonText}>
                    {saving ? 'Saving...' : isLastStep
                      ? i18n.t('continue', { defaultValue: 'Get Started' })
                      : i18n.t('continue', { defaultValue: 'Next' })}
                  </Text>
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#cce59d',
  },
  containerDesktop: {
    flexDirection: 'row',
  },
  illustrationSection: {
    width: '100%',
    flex: 0.55,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#cce59d',
  },
  illustrationSectionDesktop: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    maxWidth: 600,
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  contentSection: {
    flex: 0.45,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 5,
  },
  contentSectionDesktop: {
    flex: 1,
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'transparent',
    elevation: 0,
  },
  contentInner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  textContent: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#0b3b24',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#50555c',
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    width: '100%',
    marginTop: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 6,
  },
  dotActive: {
    backgroundColor: '#fc865a',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fc865a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  dotActiveInner: {
    backgroundColor: '#ffffff',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  buttonWrapper: {
    width: '100%',
  },
  button: {
    backgroundColor: '#fc865a',
    height: 60,
    borderRadius: 40,
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
  },
  // Profile step styles
  profileIllustration: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    flex: 0.3,
  },
  profileEmoji: {
    fontSize: 72,
  },
  inputGroup: {
    width: '100%',
    marginTop: 20,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#363b41',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#1a1f26',
    backgroundColor: '#fafafa',
  },
  skipHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#a8adb3',
    textAlign: 'center',
    marginTop: 12,
  },
});

