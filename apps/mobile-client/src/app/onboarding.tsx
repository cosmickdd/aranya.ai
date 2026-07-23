import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInRight, FadeOutLeft, FadeInUp, withSpring, useAnimatedStyle, useSharedValue, FadeInDown } from 'react-native-reanimated';
import i18n from '../lib/i18n';
import { MapPin, Check, Sprout, Leaf, CircleDot, Flame } from 'lucide-react-native';

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
    titleKey: 'onboarding_4_title',
    titleFallback: 'Welcome to Aranya',
    subtitleFallback: 'Let\'s personalize your experience to get accurate weather and mandi updates.',
    image: require('../../assets/images/onboarding3.png'),
  },
];

const PRESET_CROPS = [
  { id: 'wheat', label: 'Wheat (गेहूं)', Icon: Sprout, color: '#f59e0b' },
  { id: 'rice', label: 'Rice (धान)', Icon: Sprout, color: '#10b981' },
  { id: 'cotton', label: 'Cotton (कपास)', Icon: Leaf, color: '#6b7280' },
  { id: 'sugarcane', label: 'Sugarcane (गन्ना)', Icon: Leaf, color: '#047857' },
  { id: 'onion', label: 'Onion (प्याज)', Icon: CircleDot, color: '#b91c1c' },
  { id: 'chilli', label: 'Chilli (मिर्च)', Icon: Flame, color: '#dc2626' },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState('');
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const isLastStep = step === ONBOARDING_STEPS.length - 1;
  const isProfileStep = isLastStep;
  const buttonScaleRef = React.useRef(useSharedValue(1));

  const toggleCrop = (cropId: string) => {
    if (selectedCrops.includes(cropId)) {
      setSelectedCrops(selectedCrops.filter(id => id !== cropId));
    } else {
      setSelectedCrops([...selectedCrops, cropId]);
    }
  };

  const handleNext = async () => {
    if (!isLastStep) {
      setStep(step + 1);
      return;
    }

    setSaving(true);
    try {
      const cropsString = selectedCrops
        .map(id => PRESET_CROPS.find(c => c.id === id)?.label || id)
        .join(', ');

      if (location) await AsyncStorage.setItem('aranya_location', location);
      if (cropsString) await AsyncStorage.setItem('aranya_crops', cropsString);

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
            crops: cropsString.trim() || undefined,
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
      <View style={[styles.container, isDesktop && styles.containerDesktop, isProfileStep && styles.profileBackground]}>
        
        {/* Illustration Banner */}
        {currentStep.image && (
          <View style={[
            styles.illustrationSection, 
            isDesktop && styles.illustrationSectionDesktop,
            isProfileStep && styles.profileIllustrationSection
          ]}>
            <Animated.View key={step} entering={FadeInUp.duration(800).springify()} style={styles.imageWrapper}>
              <Image source={currentStep.image} style={styles.illustration} contentFit="cover" />
            </Animated.View>
          </View>
        )}

        {/* Content Container */}
        <View style={[
          styles.contentSection, 
          isDesktop && styles.contentSectionDesktop,
          isProfileStep && styles.profileContentSection
        ]}>
          <View style={[styles.contentInner, isProfileStep && styles.profileContentInner]}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={isProfileStep ? styles.scrollContent : undefined}
              scrollEnabled={isProfileStep}
            >
              <Animated.View
                key={step}
                entering={FadeInRight.duration(500).springify()}
                exiting={FadeOutLeft.duration(300)}
                style={styles.textContent}
              >
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

                {/* Profile Form Slide (Step 3) */}
                {isProfileStep && (
                  <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.formCard}>
                    
                    {/* Location Field */}
                    <Text style={styles.inputLabel}>Location (District / Tehsil)</Text>
                    <View style={[
                      styles.inputContainer,
                      isInputFocused && styles.inputContainerFocused
                    ]}>
                      <MapPin size={18} color={isInputFocused ? '#0b3b24' : '#9ca3af'} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your city, village or district"
                        placeholderTextColor="#9ca3af"
                        value={location}
                        onChangeText={setLocation}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                      />
                    </View>

                    {/* Crops Multi-Select Section */}
                    <Text style={styles.inputLabel}>Crops You Grow</Text>
                    <View style={styles.chipGrid}>
                      {PRESET_CROPS.map((crop) => {
                        const isSelected = selectedCrops.includes(crop.id);
                        const CropIcon = crop.Icon;
                        return (
                          <Pressable
                            key={crop.id}
                            style={[
                              styles.chip, 
                              isSelected && styles.chipSelected,
                              isSelected && { borderColor: crop.color }
                            ]}
                            onPress={() => toggleCrop(crop.id)}
                          >
                            <CropIcon 
                              size={15} 
                              color={isSelected ? '#0b3b24' : '#6b7280'} 
                              style={styles.chipIcon} 
                            />
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                              {crop.label}
                            </Text>
                            {isSelected && (
                              <View style={[styles.chipCheck, { backgroundColor: crop.color }]}>
                                <Check size={8} color="#ffffff" strokeWidth={3} />
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.skipHint}>You can update this anytime later in settings</Text>
                  </Animated.View>
                )}
              </Animated.View>
            </ScrollView>

            {/* Footer containing Pagination + Continue Button */}
            <View style={styles.footer}>
              {!isProfileStep && (
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
              )}

              <Pressable
                style={styles.buttonWrapper}
                onPressIn={() => pressButton(true)}
                onPressOut={() => pressButton(false)}
                onPress={handleNext}
                disabled={saving}
              >
                <Animated.View style={[styles.button, animatedButton]}>
                  <Text style={styles.buttonText}>
                    {saving ? 'Saving...' : isLastStep ? 'Get Started' : 'Next'}
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
  profileBackground: {
    backgroundColor: '#f4f6f8',
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
  profileContentSection: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  contentInner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  profileContentInner: {
    paddingTop: 60,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  textContent: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 26,
    color: '#0b3b24',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#50555c',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  formCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0b3b24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginTop: 10,
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#111827',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    position: 'relative',
  },
  chipSelected: {
    borderColor: '#0b3b24',
    backgroundColor: '#ecfdf5',
  },
  chipEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#4b5563',
  },
  chipTextSelected: {
    color: '#0b3b24',
    fontWeight: '600',
  },
  chipCheck: {
    marginLeft: 6,
    backgroundColor: '#0b3b24',
    borderRadius: 8,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
  },
  footer: {
    width: '100%',
    marginTop: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    height: 56,
    borderRadius: 28,
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
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
  profileIllustrationSection: {
    flex: 0.35,  // Shrunk from 0.55 to fit both image and form nicely on one screen
    backgroundColor: '#cce59d',
  },
});
