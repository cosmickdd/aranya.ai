import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to Krishi.ai',
    subtitle: 'Your intelligent farming companion.',
    color: '#E8F5E9',
  },
  {
    title: 'Real-time Insights',
    subtitle: 'Get weather and crop alerts instantly.',
    color: '#E3F2FD',
  },
  {
    title: 'Join the Community',
    subtitle: 'Connect with farmers across the nation.',
    color: '#FFF3E0',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      router.push('/sign-in');
    }
  };

  const currentStep = ONBOARDING_STEPS[step];

  return (
    <View style={[styles.container, { backgroundColor: currentStep.color }]}>
      <Animated.View 
        key={step}
        entering={SlideInRight.duration(400)} 
        exiting={SlideOutLeft.duration(400)}
        style={styles.content}
      >
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View 
              key={index} 
              style={[
                styles.dot, 
                index === step ? styles.dotActive : null
              ]} 
            />
          ))}
        </View>

        <Pressable style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {step === ONBOARDING_STEPS.length - 1 ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    width: '100%',
    padding: 32,
    paddingBottom: 60,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#111827',
    width: 24,
  },
  button: {
    backgroundColor: '#111827',
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  }
});
