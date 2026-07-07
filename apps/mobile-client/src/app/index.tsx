import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInUp, FadeIn, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const buttonScaleRef = React.useRef(useSharedValue(1));

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScaleRef.current.value }],
  }));

  const pressButton = (isPressed: boolean) => {
    buttonScaleRef.current.value = withSpring(isPressed ? 0.95 : 1);
  };

  const handleGetStarted = () => {
    // Navigate to language selection
    router.push('/language');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        
        {/* Top Spacer */}
        <View style={styles.spacer} />

        {/* Center Content */}
        <Animated.View entering={FadeInUp.duration(1000).springify()} style={styles.centerContent}>
          <View style={styles.logoWrapper}>
            <Image 
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <Animated.Text entering={FadeInUp.delay(200).duration(800).springify()} style={styles.title}>
            Aranya
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(300).duration(800).springify()} style={styles.subtitle}>
            Empowering Modern Farmers
          </Animated.Text>
        </Animated.View>

        {/* Bottom Action */}
        <Animated.View entering={FadeInUp.delay(600).duration(800).springify()} style={styles.footer}>
          <Pressable 
            onPressIn={() => pressButton(true)}
            onPressOut={() => pressButton(false)}
            onPress={handleGetStarted}
          >
            <Animated.View style={[styles.button, animatedButton]}>
              <Text style={styles.buttonText}>Get Started</Text>
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
    justifyContent: 'space-between',
  },
  containerDesktop: {
    padding: 48,
    maxWidth: 800,
  },
  spacer: {
    flex: 0.2,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 160,
    height: 160,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 48,
    color: '#0b3b24',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    color: '#17c690',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  footer: {
    paddingBottom: 24,
    paddingTop: 32,
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
