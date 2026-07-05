import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInRight, FadeOutLeft, FadeInUp, withSpring, useAnimatedStyle, useSharedValue, withTiming, FadeInDown } from 'react-native-reanimated';
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
  }
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const buttonScale = useSharedValue(1);

  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      router.push('/sign-in');
    }
  };

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const currentStep = ONBOARDING_STEPS[step];
  
  const title = i18n.t(currentStep.titleKey, { defaultValue: currentStep.titleFallback || currentStep.titleKey });
  const subtitle = i18n.t(currentStep.subtitleKey, { defaultValue: currentStep.subtitleFallback || currentStep.subtitleKey });

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {/* Left / Top Side: Illustration */}
      <View style={[styles.illustrationSection, isDesktop && styles.illustrationSectionDesktop]}>
        <Animated.View key={step} entering={FadeInUp.duration(800).springify()} style={styles.imageWrapper}>
          <Image 
            source={currentStep.image}
            style={styles.illustration}
            contentFit="cover"
          />
        </Animated.View>
      </View>

      {/* Right / Bottom Side: Content */}
      <View style={[styles.contentSection, isDesktop && styles.contentSectionDesktop]}>
        <View style={styles.contentInner}>
          <Animated.View 
            key={step}
            entering={FadeInRight.duration(500).springify()} 
            exiting={FadeOutLeft.duration(300)}
            style={styles.textContent}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
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
              onPressIn={() => (buttonScale.value = withSpring(0.95))}
              onPressOut={() => (buttonScale.value = withSpring(1))}
              onPress={handleNext}
            >
              <Animated.View style={[styles.button, animatedButton]}>
                <Text style={styles.buttonText}>
                  {step === ONBOARDING_STEPS.length - 1 ? i18n.t('continue', { defaultValue: 'Get Started' }) : i18n.t('continue', { defaultValue: 'Next' })}
                </Text>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
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
  }
});
