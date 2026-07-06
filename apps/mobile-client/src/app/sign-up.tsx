// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInUp, FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming, interpolateColor } from 'react-native-reanimated';
import { Phone, EyeOff, Eye, User, Check } from 'lucide-react-native';
import i18n from '../lib/i18n';
import { getFirebaseAuth, googleProvider, RecaptchaVerifier, signInWithPopup, signInWithPhoneNumber } from '../lib/firebase';

const PremiumInput = ({ label, placeholder, secureTextEntry, icon: IconComponent, delay, value, onChangeText, errorMessage, editable = true, keyboardType = 'default' }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const focusAnim = useSharedValue(0);

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 250 });
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 250 });
  };

  const wrapperStyle = useAnimatedStyle(() => {
    const isError = !!errorMessage;
    const activeColor = isError ? '#ef4444' : '#17c690';
    return {
      borderColor: interpolateColor(focusAnim.value, [0, 1], [isError ? '#fecaca' : '#f0f2f5', activeColor]),
      backgroundColor: interpolateColor(focusAnim.value, [0, 1], ['#f8faf9', '#ffffff']),
      shadowOpacity: focusAnim.value * 0.1,
      shadowColor: activeColor,
    };
  });

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(600).springify()} style={styles.inputGroup}>
      <Text style={styles.label}>{label}<Text style={styles.asterisk}>*</Text></Text>
      <Animated.View style={[styles.inputWrapper, wrapperStyle, !editable && styles.inputDisabled]}>
        {label === 'Mobile Number' && (
           <Text style={styles.countryCode}>+91</Text>
        )}
        <TextInput 
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#a8adb3"
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCapitalize="none"
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          keyboardType={keyboardType}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
            {showPassword ? (
               <Eye size={20} color={isFocused ? '#17c690' : '#a8adb3'} style={styles.inputIcon} />
            ) : (
               <EyeOff size={20} color={isFocused ? '#17c690' : '#a8adb3'} style={styles.inputIcon} />
            )}
          </Pressable>
        ) : (
          <IconComponent size={20} color={isFocused ? '#17c690' : '#a8adb3'} style={styles.inputIcon} />
        )}
      </Animated.View>
      {!!errorMessage && (
        <Animated.Text entering={FadeIn.duration(300)} style={styles.errorText}>{errorMessage}</Animated.Text>
      )}
    </Animated.View>
  );
};

export default function SignUp() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [termsError, setTermsError] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const buttonScale = useSharedValue(1);
  const googleScale = useSharedValue(1);

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  const animatedGoogle = useAnimatedStyle(() => ({
    transform: [{ scale: googleScale.value }],
  }));

  const validatePhone = (p) => p.length >= 10;

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(getFirebaseAuth(), 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved
        }
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      setPhoneError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (step === 1) {
      let hasError = false;
      if (name.trim().length < 2) {
        setNameError('Please enter your full name');
        hasError = true;
      }
      if (!validatePhone(phone)) {
        setPhoneError('Please enter a valid 10-digit mobile number');
        hasError = true;
      }
      if (!isAgreed) {
        setTermsError(true);
        hasError = true;
      }
      
      if (hasError) return;
      
      setNameError('');
      setPhoneError('');
      setTermsError(false);
      setIsLoading(true);
      
      try {
        if (Platform.OS === 'web') {
          setupRecaptcha();
          const appVerifier = window.recaptchaVerifier;
          const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
          const auth = getFirebaseAuth();
          const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
          setConfirmationResult(result);
          setStep(2);
        } else {
          setPhoneError('Native phone auth pending setup. Use web preview.');
        }
      } catch (error: any) {
        console.error(error);
        setPhoneError(error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      if (otp.length < 6) {
        setOtpError('OTP must be 6 digits');
        return;
      }
      setOtpError('');
      setIsLoading(true);
      
      try {
        if (confirmationResult) {
          await confirmationResult.confirm(otp);
          router.push('/dashboard');
        }
      } catch (error: any) {
        console.error(error);
        setOtpError('Invalid OTP code. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, isDesktop && styles.containerDesktop]}
      >
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <ScrollView 
            contentContainerStyle={[styles.formScroll, isDesktop && styles.formScrollDesktop]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.formContainer}>
              <Animated.Text entering={FadeInUp.delay(100).duration(600).springify()} style={styles.title}>
                Create New Account
              </Animated.Text>
              <Animated.Text entering={FadeInUp.delay(150).duration(600).springify()} style={styles.subtitle}>
                Enjoy excellent features as a Modern Farmer.
              </Animated.Text>

              <Animated.View entering={FadeInUp.delay(200).duration(600).springify()}>
                <Pressable 
                  onPressIn={() => (googleScale.value = withSpring(0.97))}
                  onPressOut={() => (googleScale.value = withSpring(1))}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <Animated.View style={[styles.googleButton, animatedGoogle]}>
                    <Image 
                      source={require('../../assets/images/google_logo.png')}
                      style={styles.googleIcon}
                    />
                    <Text style={styles.googleButtonText}>Sign Up with Google</Text>
                  </Animated.View>
                </Pressable>
              </Animated.View>

              <View nativeID="recaptcha-container" />

              <Animated.View entering={FadeInUp.delay(250).duration(600).springify()} style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or Sign Up with mobile</Text>
                <View style={styles.dividerLine} />
              </Animated.View>

              {step === 1 && (
                <PremiumInput 
                  label="Full Name" 
                  placeholder="John Doe" 
                  icon={User} 
                  delay={200} 
                  value={name}
                  onChangeText={(t) => { setName(t); setNameError(''); }}
                  errorMessage={nameError}
                  editable={!isLoading}
                />
              )}

              {step === 1 && (
                <PremiumInput 
                  label="Mobile Number" 
                  placeholder="98765 43210" 
                  icon={Phone} 
                  delay={300} 
                  value={phone}
                  onChangeText={(t) => { setPhone(t); setPhoneError(''); }}
                  errorMessage={phoneError}
                  editable={!isLoading}
                  keyboardType="phone-pad"
                />
              )}

              {step === 2 && (
                <PremiumInput 
                  label="6-Digit OTP" 
                  placeholder="••••••" 
                  secureTextEntry 
                  icon={EyeOff} 
                  delay={100} 
                  value={otp}
                  onChangeText={(t) => { setOtp(t); setOtpError(''); }}
                  errorMessage={otpError}
                  editable={!isLoading}
                  keyboardType="number-pad"
                />
              )}

              {step === 2 && (
                <Animated.View entering={FadeInUp.delay(200).duration(600).springify()}>
                  <Pressable style={[styles.resendLink, { alignSelf: 'center', marginTop: 16 }]} onPress={() => { setStep(1); setOtp(''); }}>
                    <Text style={styles.resendText}>Change Number / Resend</Text>
                  </Pressable>
                </Animated.View>
              )}

              {step === 1 && (
                <>
                  <Animated.View entering={FadeInUp.delay(400).duration(600).springify()} style={styles.checkboxRow}>
                    <Pressable 
                      style={[
                        styles.checkbox, 
                        !isAgreed && styles.checkboxUnchecked,
                        termsError && styles.checkboxError
                      ]}
                      onPress={() => { setIsAgreed(!isAgreed); setTermsError(false); }}
                      hitSlop={10}
                      disabled={isLoading}
                    >
                      {isAgreed && <Check size={14} color="#ffffff" />}
                    </Pressable>
                    <Text style={[styles.termsText, termsError && styles.termsTextError]}>
                      By signing up, you agree to our <Text style={styles.termsLink}>Terms & Conditions</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
                    </Text>
                  </Animated.View>

                  <Animated.View entering={FadeInUp.delay(450).duration(600).springify()}>
                    <Pressable 
                      onPressIn={() => (buttonScale.value = withSpring(0.95))}
                      onPressOut={() => (buttonScale.value = withSpring(1))}
                      onPress={handlePrimaryAction}
                      disabled={isLoading}
                    >
                      <Animated.View style={[styles.primaryButton, animatedButton, isLoading && styles.primaryButtonDisabled]}>
                        {isLoading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>
                            Send OTP
                          </Text>
                        )}
                      </Animated.View>
                    </Pressable>
                  </Animated.View>
                </>
              )}

              {step === 2 && (
              <Animated.View entering={FadeInUp.delay(450).duration(600).springify()}>
                <Pressable 
                  onPressIn={() => (buttonScale.value = withSpring(0.95))}
                  onPressOut={() => (buttonScale.value = withSpring(1))}
                  onPress={handlePrimaryAction}
                  disabled={isLoading}
                >
                  <Animated.View style={[styles.primaryButton, animatedButton, isLoading && styles.primaryButtonDisabled]}>
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Verify & Sign Up
                      </Text>
                    )}
                  </Animated.View>
                </Pressable>
              </Animated.View>
              )}

              <Animated.View entering={FadeInUp.delay(500).duration(600).springify()}>
                <Pressable style={styles.footerLink} onPress={() => router.push('/sign-in')} disabled={isLoading}>
                  <Text style={styles.footerText}>Already a member? <Text style={styles.footerTextBold}>Sign In</Text></Text>
                </Pressable>
              </Animated.View>
            </View>
          </ScrollView>

        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f4f6', 
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDesktop: {
    padding: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  card: {
    flex: 1,
    width: '100%',
  },
  cardDesktop: {
    flexDirection: 'row',
    maxWidth: 1100,
    maxHeight: 800,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.08,
    shadowRadius: 48,
    elevation: 24,
  },
  illustrationSection: {
    width: '100%',
    height: 180, 
  },
  illustrationSectionDesktop: {
    flex: 1,
    height: '100%',
    borderRightWidth: 1,
    borderColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  formScroll: {
    flexGrow: 1,
  },
  formScrollDesktop: {
    flex: 1,
    justifyContent: 'center',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 48,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 32,
    color: '#0b3b24',
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#50555c',
    marginBottom: 32, 
    lineHeight: 22,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 32,
    marginBottom: 24, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#363b41',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24, 
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f0f2f5',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#a8adb3',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  inputGroup: {
    marginBottom: 20, 
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#363b41',
    marginBottom: 8,
  },
  asterisk: {
    color: '#17c690',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.04,
    elevation: 2,
  },
  countryCode: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#0b3b24',
    marginRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    paddingRight: 12,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#0b3b24',
    // @ts-ignore
    outlineStyle: 'none',
  },
  inputIcon: {
    marginLeft: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
    marginLeft: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#17c690',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
    borderWidth: 2,
    borderColor: '#17c690',
  },
  checkboxUnchecked: {
    backgroundColor: 'transparent',
    borderColor: '#a8adb3',
  },
  checkboxError: {
    borderColor: '#ef4444',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#50555c',
    lineHeight: 20,
  },
  termsTextError: {
    color: '#ef4444',
  },
  termsLink: {
    fontFamily: 'Inter_600SemiBold',
    color: '#17c690',
  },
  resendLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 16, 
  },
  resendText: {
    color: '#17c690',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#fc865a',
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24, 
    shadowColor: '#fc865a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
  footerLink: {
    alignItems: 'center',
  },
  footerText: {
    color: '#a8adb3',
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  footerTextBold: {
    color: '#17c690',
    fontFamily: 'Inter_700Bold',
  }
});
