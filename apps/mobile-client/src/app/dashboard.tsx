// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, ImageBackground, ActivityIndicator, Modal, Dimensions, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Phone, Paperclip, Camera as CameraIcon, Send, Check, CheckCheck, X, Mic, Volume2, PhoneOff, Play, Pause, MoreVertical, Trash2, Flag, LogOut, ChevronDown, Lock, MicOff, MessageSquare, Zap, ZapOff, Image as ImageIcon, RotateCw, FileText, MapPin, CloudSun, TestTube, Leaf, Navigation, ExternalLink, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, FadeInDown, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, interpolate } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import i18n from '../lib/i18n';
import { fetchSarvamTTS } from '../lib/sarvam';
import { fetchWeather, fetchSoilLabs, weatherEmoji } from '../lib/weather';
import { loadUserProfile, saveUserProfile } from '../lib/userProfile';

// ═══════════════════════════════════════════════════════
// AUDIO HELPERS — cross-platform (Web Audio API on web, expo-av on native)
// ═══════════════════════════════════════════════════════
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

let _audioCtx: AudioContext | null = null;
function getWebAudioContext(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

let _activeAudioPlayer: any = null;
let _webAudioSource: any = null;

async function stopActiveAudio(): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
  if (_webAudioSource) {
    try { _webAudioSource.stop(); } catch (e) {}
    _webAudioSource = null;
  }
  if (_activeAudioPlayer) {
    try {
      _activeAudioPlayer.pause();
      _activeAudioPlayer.release();
    } catch (e) {
      console.error('Error stopping active player:', e);
    }
    _activeAudioPlayer = null;
  }
}

async function playBase64Audio(base64: string): Promise<void> {
  await stopActiveAudio();
  if (Platform.OS !== 'web') {
    const FileSystem = require('expo-file-system');
    const fileUri = `${FileSystem.cacheDirectory}temp_voice_${Date.now()}.wav`;
    let player: any = null;
    try {
      // CRITICAL: set allowsRecording=false so audio routes to SPEAKER not earpiece
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          shouldDuckAndroid: false,
        });
      } catch (e) {
        console.warn('setAudioModeAsync error:', e);
      }
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      player = createAudioPlayer({ uri: fileUri });
      _activeAudioPlayer = player;
      player.play();
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 60000); // safety timeout
        const subscription = player.addListener('playbackStatusUpdate', (status: any) => {
          if (status.didJustFinish) {
            clearTimeout(timeout);
            subscription.remove();
            resolve();
          }
        });
      });
    } catch (e) {
      console.error('Native audio playback error:', e);
    } finally {
      _activeAudioPlayer = null;
      if (player) {
        try { player.release(); } catch (_) {}
      }
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (_) {}
      // Restore recording-ready audio mode
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
      } catch (_) {}
    }
    return;
  }
  // ── Web ── Web Audio API
  return new Promise(async (resolve, reject) => {
    try {
      const ctx = getWebAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const arrayBuffer = base64ToArrayBuffer(base64);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      _webAudioSource = source;
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        _webAudioSource = null;
        resolve();
      };
      source.start(0);
    } catch (e) {
      console.error('Web audio playback error:', e);
      reject(e);
    }
  });
}

async function playFallbackAudio(text: string, langCode: string): Promise<void> {
  if (Platform.OS !== 'web') {
    let player: any = null;
    try {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          shouldDuckAndroid: false,
        });
      } catch (e) {
        console.warn('setAudioModeAsync error:', e);
      }
      const lang = langCode === 'hi' ? 'hi' : 'en';
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
      
      player = createAudioPlayer({ uri: ttsUrl });
      _activeAudioPlayer = player;
      player.play();
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 60000);
        const subscription = player.addListener('playbackStatusUpdate', (status: any) => {
          if (status.didJustFinish) {
            clearTimeout(timeout);
            subscription.remove();
            resolve();
          }
        });
      });
    } catch (e) {
      console.error('Native fallback playback error:', e);
    } finally {
      _activeAudioPlayer = null;
      if (player) { try { player.release(); } catch (_) {} }
    }
    return;
  }
  
  // Web Fallback
  return new Promise((resolve) => {
    try {
      const lang = langCode === 'hi' ? 'hi' : 'en';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Web fallback error', e);
      resolve();
    }
  });
}

// ═══════════════════════════════════════════════════════
// PERMISSIONS ONBOARDING MODAL
// ═══════════════════════════════════════════════════════
function PermissionsOnboarding({ onDone }: { onDone: () => void }) {
  const [granting, setGranting] = useState(false);
  const grantAll = async () => {
    setGranting(true);
    try { await requestRecordingPermissionsAsync(); } catch (_) {}
    try { await Location.requestForegroundPermissionsAsync(); } catch (_) {}
    setGranting(false);
    onDone();
  };

  const permissions = [
    { icon: <Mic size={22} color="#10b981" />, title: 'Microphone Access', desc: 'Chat naturally in Hindi, Marathi, or English', color: '#10b981' },
    { icon: <MapPin size={22} color="#3b82f6" />, title: 'Location Services', desc: 'Get live local weather and find nearest soil labs', color: '#3b82f6' },
    { icon: <CameraIcon size={22} color="#f59e0b" />, title: 'Camera & Gallery', desc: 'Scan and diagnose crop health instantly', color: '#f59e0b' },
  ];

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(5, 10, 15, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{
          backgroundColor: '#0a121a',
          borderRadius: 24,
          padding: 24,
          width: '100%',
          maxWidth: 380,
          borderWidth: 1.5,
          borderColor: 'rgba(16, 185, 129, 0.25)',
          shadowColor: '#10b981',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.15,
          shadowRadius: 24,
          elevation: 10,
        }}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 26 }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
              <Leaf size={34} color="#10b981" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 }}>Aranya Onboarding</Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 10 }}>
              Allow the following permissions to enable real-time local intelligence features.
            </Text>
          </View>

          {/* Cards */}
          {permissions.map((p, i) => (
            <View key={i} style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.06)',
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: p.color + '15',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                borderWidth: 1,
                borderColor: p.color + '30',
              }}>
                {p.icon}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>{p.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3, lineHeight: 15 }}>{p.desc}</Text>
              </View>
            </View>
          ))}

          {/* Action Button */}
          <Pressable
            onPress={grantAll}
            style={({ pressed }) => ({
              backgroundColor: '#10b981',
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 12,
              opacity: pressed ? 0.9 : 1,
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 4,
            })}>
            {granting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>
                Grant Permissions
              </Text>
            )}
          </Pressable>

          <Pressable onPress={onDone} style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: 13, fontWeight: '600' }}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}


// ═══════════════════════════════════════════════════════
// WEATHER CARD (in-chat bubble)
// ═══════════════════════════════════════════════════════
function WeatherCard({ weather, onClose }: { weather: any; onClose?: () => void }) {
  if (!weather) return null;
  const emoji = weatherEmoji ? weatherEmoji(weather.condition || '') : '🌤️';
  const rainEntry = weather.forecast?.find((f: any) => f.rain_prob > 50);

  return (
    <View style={{
      backgroundColor: '#0a1424',
      borderRadius: 20,
      padding: 18,
      marginVertical: 10,
      borderWidth: 1.5,
      borderColor: 'rgba(59, 130, 246, 0.25)',
      shadowColor: '#3b82f6',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 6,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 32, marginRight: 12 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CloudSun size={14} color="#60a5fa" style={{ marginRight: 5 }} />
            <Text style={{ color: '#60a5fa', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 }}>Live Weather Update</Text>
          </View>
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 18, marginTop: 2 }}>{weather.location}</Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 }}>
            <X size={14} color="rgba(255,255,255,0.6)" />
          </Pressable>
        )}
      </View>

      {/* Main Stats Grid */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
      }}>
        {/* Temp */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' }}>Temperature</Text>
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 24, marginVertical: 4 }}>{Math.round(weather.temp)}°C</Text>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '500' }}>Feels {Math.round(weather.feels_like)}°</Text>
        </View>
        <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        {/* Humidity */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' }}>Humidity</Text>
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 24, marginVertical: 4 }}>{weather.humidity}%</Text>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '500', textAlign: 'center' }} numberOfLines={1}>{weather.condition}</Text>
        </View>
        <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        {/* Wind */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' }}>Wind Speed</Text>
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 24, marginVertical: 4 }}>{weather.wind_speed?.toFixed(1)}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '500' }}>m/s</Text>
        </View>
      </View>

      {/* Rain Warning */}
      {rainEntry && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(239, 68, 68, 0.2)',
        }}>
          <Text style={{ fontSize: 18, marginRight: 10 }}>🌧️</Text>
          <Text style={{ color: '#fca5a5', fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 }}>
            Rain forecast of {Math.round(rainEntry.rain_prob)}% soon. Delay any fertilizer spraying operations!
          </Text>
        </View>
      )}

      {/* Farming Advice */}
      {weather.farming_advice && (
        <View style={{
          backgroundColor: 'rgba(16, 185, 129, 0.06)',
          borderRadius: 14,
          padding: 14,
          borderLeftWidth: 4,
          borderLeftColor: '#10b981',
          borderWidth: 1,
          borderColor: 'rgba(16, 185, 129, 0.1)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Leaf size={14} color="#10b981" style={{ marginRight: 6 }} />
            <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>AGRI ADVISORY</Text>
          </View>
          <Text style={{ color: '#a7f3d0', fontSize: 13, lineHeight: 19, fontWeight: '500' }}>{weather.farming_advice}</Text>
        </View>
      )}
    </View>
  );
}


// ═══════════════════════════════════════════════════════
// SOIL LABS BOTTOM SHEET
// ═══════════════════════════════════════════════════════
function SoilLabsSheet({ visible, labs, portalUrl, onClose }: { visible: boolean; labs: any[]; portalUrl: string; onClose: () => void }) {
  if (!visible) return null;
  const openMaps = (lab: any) => {
    const url = Platform.OS === 'android'
      ? `geo:${lab.lat},${lab.lon}?q=${encodeURIComponent(lab.name)}`
      : `maps:${lab.lat},${lab.lon}?q=${encodeURIComponent(lab.name)}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${lab.lat},${lab.lon}`));
  };
  const callLab = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} onPress={onClose} />
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#0a121a',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '85%',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingBottom: 24,
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TestTube size={18} color="#10b981" style={{ marginRight: 6 }} />
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 18 }}>Soil Testing Labs</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Government certified labs near your current location</Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
            <X size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {labs.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <MapPin size={28} color="rgba(255,255,255,0.3)" />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 14 }}>No labs found nearby. Use the government portal link below to search.</Text>
            </View>
          ) : labs.map((lab, i) => (
            <View key={i} style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.05)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' }}>
                  <Leaf size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, flexWrap: 'wrap' }}>{lab.name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4, lineHeight: 16 }}>{lab.address}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <MapPin size={11} color="#10b981" />
                    <Text style={{ color: '#10b981', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>{lab.distance_km} km away</Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => callLab(lab.phone)} style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 12, paddingVertical: 10,
                  opacity: pressed ? 0.75 : 1, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)'
                })}>
                  <Phone size={13} color="#10b981" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 13 }}>Call Lab</Text>
                </Pressable>
                <Pressable onPress={() => openMaps(lab)} style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 12, paddingVertical: 10,
                  opacity: pressed ? 0.75 : 1, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)'
                })}>
                  <Navigation size={13} color="#60a5fa" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#60a5fa', fontWeight: '700', fontSize: 13 }}>Directions</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable onPress={() => Linking.openURL(portalUrl)} style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', opacity: pressed ? 0.8 : 1,
            marginTop: 4,
          })}>
            <ExternalLink size={14} color="rgba(255,255,255,0.5)" style={{ marginRight: 8 }} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' }}>View All Labs on Government Portal</Text>
          </Pressable>
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// SOIL HEALTH CARD MODAL
// ═══════════════════════════════════════════════════════
function SoilHealthCardModal({ visible, profile, onClose, onSave }: { visible: boolean; profile: any; onClose: () => void; onSave: (data: any) => void }) {
  const [cardId, setCardId] = useState(profile?.soilHealthCardId || '');
  const [nitrogen, setNitrogen] = useState(profile?.soilHealthData?.nitrogen || '');
  const [phosphorus, setPhosphorus] = useState(profile?.soilHealthData?.phosphorus || '');
  const [potassium, setPotassium] = useState(profile?.soilHealthData?.potassium || '');
  const [ph, setPh] = useState(profile?.soilHealthData?.ph || '');
  const [oc, setOc] = useState(profile?.soilHealthData?.oc || '');

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#0a121a',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 24, paddingBottom: 40,
          borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)'
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Leaf size={18} color="#10b981" style={{ marginRight: 6 }} />
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 18 }}>Soil Health Card</Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
              <X size={16} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          {/* Portal button */}
          <Pressable onPress={() => Linking.openURL('https://www.soilhealth.dac.gov.in/soilhealthcard')} style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(16,185,129,0.08)',
            borderRadius: 16, padding: 14, marginBottom: 22,
            borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', opacity: pressed ? 0.8 : 1,
          })}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <ExternalLink size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 14 }}>Get Your Soil Health Card</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>View/Download on Government Portal →</Text>
            </View>
          </Pressable>

          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600', marginBottom: 12 }}>Or enter nutrient values manually:</Text>
          
          <TextInput
            value={cardId} onChangeText={setCardId}
            placeholder="Soil Health Card ID (optional)"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 12, padding: 14,
              color: '#ffffff', marginBottom: 12,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
              fontWeight: '600', fontSize: 14,
            }}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Nitrogen (N)', val: nitrogen, set: setNitrogen, unit: 'kg/ha' },
              { label: 'Phosphorus (P)', val: phosphorus, set: setPhosphorus, unit: 'kg/ha' },
              { label: 'Potassium (K)', val: potassium, set: setPotassium, unit: 'kg/ha' },
              { label: 'Soil pH', val: ph, set: setPh, unit: '' },
              { label: 'Org Carbon (OC)', val: oc, set: setOc, unit: '%' }
            ].map((field, i) => (
              <View key={i} style={{
                width: i === 4 ? '100%' : '48%',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{field.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                  <TextInput
                    value={field.val} onChangeText={field.set}
                    placeholder="--" placeholderTextColor="rgba(255,255,255,0.15)"
                    keyboardType="numeric"
                    style={{ color: '#10b981', fontWeight: '800', fontSize: 18, padding: 0, minWidth: 40 }}
                  />
                  {field.unit ? <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginLeft: 4 }}>{field.unit}</Text> : null}
                </View>
              </View>
            ))}
          </View>

          <Pressable onPress={() => onSave({ soilHealthCardId: cardId, soilHealthData: { nitrogen, phosphorus, potassium, ph, oc } })} style={({ pressed }) => ({
            backgroundColor: '#10b981', borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', opacity: pressed ? 0.9 : 1,
            shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
          })}>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>Save Soil Data</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}


// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
type Message = {
  id: string;
  text: string;
  isSender: boolean;
  hasCallAction?: boolean;
  timestamp?: string;
  status?: 'sent' | 'delivered' | 'read';
  image_base64?: string;
  audio_base64?: string;
  audio_uri?: string;
  isVoiceNote?: boolean;
  isTranscribing?: boolean;
  voiceDuration?: number;
  isDocument?: boolean;
  doc_name?: string;
  doc_uri?: string;
  isLocation?: boolean;
  locationLabel?: string;
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const MediaLibrary = Platform.OS !== 'web' ? require('expo-media-library') : null;

const renderFormattedText = (text: string, isSender: boolean) => {
  if (!text) return '';
  const parts = text.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <Text key={index} style={{ fontWeight: '700', color: isSender ? '#ffffff' : '#1f2937' }}>
          {part}
        </Text>
      );
    }
    return part;
  });
};

export default function Dashboard() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<{ uri: string; name: string; mimeType?: string; base64?: string } | null>(null);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const isNearBottomRef = useRef(true);

  // ── Location & Weather ──
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [showWeatherCard, setShowWeatherCard] = useState(false);
  const [soilLabs, setSoilLabs] = useState<any[]>([]);
  const [soilLabsPortalUrl, setSoilLabsPortalUrl] = useState('https://www.soilhealth.dac.gov.in/soilTestingLabs');
  const [showSoilLabs, setShowSoilLabs] = useState(false);
  const [showSoilHealthCard, setShowSoilHealthCard] = useState(false);
  const [userProfile, setUserProfile] = useState<any>({});
  const [showPermissions, setShowPermissions] = useState(false);

  // Voice Mode
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false); // stable ref to avoid stale closure in async callbacks
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoiceMinimized, setIsVoiceMinimized] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const hasSpokenRef = useRef(false);
  const silenceStartRef = useRef<number>(0);
  const voiceStateRef = useRef<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  const silenceTimeoutRef = useRef<any>(null);

  // Voice Note Mode (inline recording)
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState(0);
  const voiceNoteTimerRef = useRef<any>(null);

  // Pulsing dot animation for inline recording
  const recordPulse = useSharedValue(1);
  useEffect(() => {
    if (isRecordingVoiceNote) {
      recordPulse.value = withRepeat(
        withTiming(1.4, { duration: 1000 }),
        -1,
        true
      );
    } else {
      recordPulse.value = 1;
    }
  }, [isRecordingVoiceNote]);

  const redDotStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: recordPulse.value }],
      opacity: interpolate(recordPulse.value, [1, 1.4], [1, 0.5]),
    };
  });

  // Audio Recorder Hook
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  const recorderState = useAudioRecorderState(recorder, 200);

  // Monitor voice levels for Voice Activity Detection (VAD) during calls
  useEffect(() => {
    if (!recorderState.isRecording) return;
    const metering = recorderState.metering ?? -160;
    const now = Date.now();
    
    // Stable volume threshold (-48dB) to handle background noise floor properly
    if (metering > -48) {
      silenceStartRef.current = now;
      if (!hasSpokenRef.current) {
        hasSpokenRef.current = true;
      }
    } else {
      if (
        !isRecordingVoiceNote &&
        hasSpokenRef.current &&
        silenceStartRef.current > 0 &&
        (now - silenceStartRef.current > 2000) &&
        voiceStateRef.current === 'listening'
      ) {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        stopRecording();
      }
    }
  }, [recorderState.metering, recorderState.isRecording, isRecordingVoiceNote]);

  const handleSilenceTimeout = useCallback(async () => {
    if (voiceStateRef.current !== 'listening') return;
    
    try {
      await recorder.stop();
      const uri = recorder.uri;
      
      // Force send the audio anyway if there is a URI (bypass VAD silence check on timeout)
      if (uri) {
        hasSpokenRef.current = true; // force spoken flag
        setVoiceState('processing');
        await sendVoiceToBackend(uri);
        return;
      }
    } catch (_) {}
    
    setVoiceState('speaking');
    const msg = i18n.locale === 'hi' 
      ? 'Maaf kijiyega, mujhe aapki awaaz nahi sunai di. Kripya thoda tez bolein.' 
      : 'Sorry, I couldn\'t hear you. Please speak a bit louder.';
      
    setVoiceTranscript(msg);
    
    try {
      await playFallbackAudio(msg, i18n.locale);
    } catch (e) {
      console.error('Silence feedback TTS error:', e);
    } finally {
      setVoiceState('idle');
      setTimeout(() => {
        if (voiceModeRef.current) {
          startRecording();
        }
      }, 100);
    }
  }, [recorderState.isRecording, recorder]);

  const handleSilenceTimeoutRef = useRef(handleSilenceTimeout);
  useEffect(() => {
    handleSilenceTimeoutRef.current = handleSilenceTimeout;
  }, [handleSilenceTimeout]);

  useEffect(() => {
    if (voiceState === 'listening') {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = setTimeout(() => {
        handleSilenceTimeoutRef.current();
      }, 8000);
    } else {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }
    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, [voiceState]);

  // Custom WhatsApp Camera Modal States
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [flashMode, setFlashMode] = useState<'on' | 'off'>('off');
  const [cameraMode, setCameraMode] = useState<'photo' | 'video' | 'videonote'>('photo');
  const [cameraType, setCameraType] = useState<'back' | 'front'>(Platform.OS === 'web' ? 'front' : 'back');
  const [galleryPhotos, setGalleryPhotos] = useState<{ id: string; uri: string }[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Hardware back button behavior
  useEffect(() => {
    const backAction = () => {
      if (voiceMode) {
        exitVoiceMode();
        return true;
      }
      if (cameraModalVisible) {
        setCameraModalVisible(false);
        return true;
      }
      // Exit app directly from main dashboard layout rather than popping auth screens
      BackHandler.exitApp();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [voiceMode, cameraModalVisible]);
  
  const [permission, requestPermission] = useCameraPermissions();
  const hasCameraPermission = permission ? permission.granted : false;
  
  const cameraRef = useRef<any>(null);

  const loadGalleryPhotos = async () => {
    if (Platform.OS === 'web' || !MediaLibrary) {
      setGalleryPhotos([
        { id: '1', uri: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200&q=80' },
        { id: '2', uri: 'https://images.unsplash.com/photo-1536630590251-40439a0f675f?w=200&q=80' },
        { id: '3', uri: 'https://images.unsplash.com/photo-1551893086-c02cbf3a9a88?w=200&q=80' },
        { id: '4', uri: 'https://images.unsplash.com/photo-1600697395593-e9dc66797e43?w=200&q=80' },
      ]);
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const { assets } = await MediaLibrary.getAssetsAsync({
          first: 10,
          sortBy: [MediaLibrary.SortBy.creationTime],
          mediaType: [MediaLibrary.MediaType.photo],
        });
        setGalleryPhotos(assets.map((a: any) => ({ id: a.id, uri: a.uri })));
      } else {
        throw new Error('Permission denied');
      }
    } catch (e) {
      console.log('Native MediaLibrary error:', e);
    }
  };

  useEffect(() => {
    if (cameraModalVisible) {
      setCameraError(null);
      if (!permission || !permission.granted) {
        requestPermission();
      }
      loadGalleryPhotos();
    }
  }, [cameraModalVisible, permission]);

  // Ripple Animations
  const ripple1 = useSharedValue(1);
  const ripple2 = useSharedValue(1);
  const volumeScale = useSharedValue(1.0);

  useEffect(() => {
    if (voiceState === 'listening' && recorderState.isRecording) {
      const metering = recorderState.metering ?? -160;
      // Map dB range (-60 to 0) to scale (1.0 to 1.8)
      const targetScale = Math.max(1.0, 1.0 + (metering + 60) / 60 * 0.8);
      volumeScale.value = withTiming(targetScale, { duration: 150 });
    } else {
      volumeScale.value = withTiming(1.0, { duration: 200 });
    }
  }, [recorderState.metering, voiceState, recorderState.isRecording, volumeScale]);

  useEffect(() => {
    if (voiceState === 'speaking') {
      ripple1.value = 1;
      ripple2.value = 1;
      ripple1.value = withRepeat(
        withTiming(1.6, { duration: 2000 }),
        -1,
        false
      );
      ripple2.value = withDelay(
        1000,
        withRepeat(
          withTiming(1.6, { duration: 2000 }),
          -1,
          false
        )
      );
    } else {
      ripple1.value = 1;
      ripple2.value = 1;
    }
  }, [voiceState, ripple1, ripple2]);

  const rippleColor = voiceState === 'speaking' ? 'rgba(23, 198, 144, 0.2)' : 'rgba(251, 146, 60, 0.2)';

  const rippleStyle1 = useAnimatedStyle(() => {
    const scale = voiceState === 'listening' ? volumeScale.value : ripple1.value;
    const opacity = voiceState === 'listening' 
      ? interpolate(volumeScale.value, [1.0, 1.8], [0.3, 0.9])
      : 1 - (ripple1.value - 1) / 0.6;
    return {
      transform: [{ scale }],
      opacity,
      backgroundColor: rippleColor,
    };
  });

  const rippleStyle2 = useAnimatedStyle(() => {
    const scale = voiceState === 'listening' ? volumeScale.value * 1.3 : ripple2.value;
    const opacity = voiceState === 'listening'
      ? interpolate(volumeScale.value, [1.0, 1.8], [0.15, 0.6])
      : 1 - (ripple2.value - 1) / 0.6;
    return {
      transform: [{ scale }],
      opacity,
      backgroundColor: rippleColor,
    };
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'नमस्ते! 🙏 मैं अरण्य हूँ, आपका AI कृषि मित्र। आज मैं आपकी फसल, मौसम या मंडी भाव में कैसे मदद कर सकता हूँ?',
      isSender: false,
      hasCallAction: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  useEffect(() => {
    AsyncStorage.getItem('aranya_chat_history').then(data => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {
          console.error('Failed to load chat history', e);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('aranya_chat_history', JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  // ── Startup: permissions, profile, location, weather ──
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Load user profile
        const profile = await loadUserProfile();
        setUserProfile(profile);

        // 2. Show permissions onboarding if first time
        if (!profile.permissionsShown) {
          setShowPermissions(true);
        } else {
          // Already shown, silently fetch location
          fetchLocationAndWeather();
        }
      } catch (e) {
        console.error('Dashboard init error:', e);
      }
    };
    init();
  }, []);

  const fetchLocationAndWeather = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = loc.coords;
      setUserLocation({ lat, lon });
      await saveUserProfile({ lat, lon });

      // Fetch weather in background
      const weather = await fetchWeather(lat, lon);
      if (weather) setWeatherData(weather);

      // Pre-fetch soil labs
      const labsResult = await fetchSoilLabs(lat, lon, 5);
      if (labsResult) {
        setSoilLabs(labsResult.labs || []);
        setSoilLabsPortalUrl(labsResult.portal_url || soilLabsPortalUrl);
      }
    } catch (e) {
      console.error('fetchLocationAndWeather error:', e);
    }
  };

  // Call timer
  useEffect(() => {
    if (!voiceMode) return;
    const interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [voiceMode]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Audio Playback ──
  const playAudio = async (audioSource: { base64?: string; uri?: string }, msgId: string) => {
    try {
      await stopActiveAudio();
      if (playingId === msgId) {
        setPlayingId(null);
        return;
      }
      setPlayingId(msgId);
      if (audioSource.uri) {
        try {
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
            interruptionMode: 'duckOthers',
            shouldDuckAndroid: false,
          });
        } catch (e) {
          console.warn('setAudioModeAsync error:', e);
        }
        const player = createAudioPlayer({ uri: audioSource.uri });
        _activeAudioPlayer = player;
        player.play();
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 60000);
          const subscription = player.addListener('playbackStatusUpdate', (status: any) => {
            if (status.didJustFinish) {
              clearTimeout(timeout);
              subscription.remove();
              resolve();
            }
          });
        });
        _activeAudioPlayer = null;
        try { player.release(); } catch (_) {}
      } else if (audioSource.base64) {
        await playBase64Audio(audioSource.base64);
      }
      setPlayingId(null);
    } catch (error) {
      console.error('Audio play error:', error);
      setPlayingId(null);
    }
  };

  // ── Image Picker ──
  const pickImage = async (useCamera = false) => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true, quality: 0.5, base64: true,
      };
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera access is needed to take photos. Please enable it in your device Settings.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled && result.assets?.[0]?.base64) {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) { console.error("Image pick error:", error); }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true, // required so the image can be sent to the AI backend
        });
        if (photo && photo.uri) {
          // Use base64 data URI so it can be sent to the backend for analysis
          const imageData = photo.base64
            ? `data:image/jpeg;base64,${photo.base64}`
            : photo.uri;
          setSelectedImage(imageData);
          setCameraModalVisible(false);
        }
      } catch (e) {
        console.error('Failed to take picture, falling back to system camera:', e);
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          allowsEditing: true, quality: 0.5, base64: true,
        };
        const result = await ImagePicker.launchCameraAsync(options);
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          setSelectedImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
          setCameraModalVisible(false);
        }
      }
    }
  };

  // ── Document Picker ──
  const pickDocument = async () => {
    setAttachmentSheetVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // allow all documents/files
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        let base64Data = '';
        
        if (Platform.OS !== 'web') {
          const FileSystem = require('expo-file-system');
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
        
        setSelectedDoc({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          base64: base64Data,
        });
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  };

  // ── Share Location ──
  const shareLocation = async () => {
    setAttachmentSheetVisible(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to share coordinates.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      const city = geocode[0]?.city || geocode[0]?.district || geocode[0]?.region || '';
      
      const locationLabel = city || 'My Current Location';

      sendMessage(`Location: ${locationLabel}`, null, null, true, locationLabel);
    } catch (error) {
      console.error('Location share error:', error);
    }
  };

  // ── Send Message (shared by chat and voice) ──
  const sendMessage = useCallback(async (text: string, imgB64?: string | null, docAttachment?: { uri: string; name: string; mimeType?: string; base64?: string } | null, isLocation?: boolean, locationLabel?: string) => {
    if (!text.trim() && !imgB64 && !docAttachment && !isLocation) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isSender: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      image_base64: imgB64 || undefined,
      isDocument: !!docAttachment,
      doc_name: docAttachment?.name,
      doc_uri: docAttachment?.uri,
      isLocation,
      locationLabel,
    };
    setMessages(prev => [...prev, newMsg]);
    setIsTyping(true);
    if (voiceMode) setVoiceState('processing');

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sarvam-API-Key': process.env.EXPO_PUBLIC_SARVAM_API_KEY || '',
        },
        body: JSON.stringify({
          message: text.trim(),
          user_id: 'demo_user_123',
          language: i18n.locale,
          image_base64: imgB64,
          doc_base64: docAttachment?.base64 || undefined,
          doc_mime: docAttachment?.mimeType || 'application/pdf',
          // Location context — gives AI hyper-local weather awareness
          lat: userLocation?.lat,
          lon: userLocation?.lon,
          // Soil health card data for personalized fertilizer advice
          soil_health_data: userProfile?.soilHealthData || undefined,
        }),
      });
      const data = await response.json();
      setMessages(prev => prev.map(m => m.isSender ? { ...m, status: 'read' } : m));

      if (data.reply) {
        const reply: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          isSender: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          audio_base64: data.audio_base64 || undefined,
          isVoiceNote: !!data.audio_base64,
          voiceDuration: data.audio_base64 ? Math.ceil(data.reply.length / 15) : undefined,
        };
        setMessages(prev => [...prev, reply]);

        // Auto-play in voice mode
        if (voiceMode && data.audio_base64) {
          setVoiceState('speaking');
          try {
            await playBase64Audio(data.audio_base64);
          } catch (e) { console.error('Voice autoplay error:', e); }
          setVoiceState('idle');
        }
      }
    } catch (error) {
      console.error('Chat API Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I am having trouble connecting. Please try again.',
        isSender: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      if (voiceMode) setVoiceState('idle');
    } finally {
      setIsTyping(false);
      if (!voiceMode) return;
    }
  }, [voiceMode]);

  // ── Chat Send ──
  const handleSend = () => {
    const text = inputText.trim();
    const img = selectedImage;
    const doc = selectedDoc;
    setInputText('');
    setSelectedImage(null);
    setSelectedDoc(null);
    sendMessage(text, img, doc);
  };

  // ── Voice Recording via expo-audio (Universal) ──
  const startRecording = async () => {
    try {
      // Step 1: Request permission FIRST
      let permission = await requestRecordingPermissionsAsync();
      let isGranted = permission.status === 'granted' || permission.granted === true;

      if (!isGranted && AudioModule?.requestRecordingPermissionsAsync) {
        permission = await AudioModule.requestRecordingPermissionsAsync();
        isGranted = permission.status === 'granted' || permission.granted === true;
      }

      if (!isGranted) {
        Alert.alert(
          'Microphone Permission Required',
          'Aranya needs microphone access for voice chat. Please enable Microphone permissions for Aranya AI in your phone Settings → Apps → Aranya AI → Permissions.',
          [{ text: 'OK' }]
        );
        setVoiceState('idle');
        return;
      }

      // Step 2: Set audio mode AFTER permission granted
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch (modeErr) {
        console.warn('setAudioModeAsync error:', modeErr);
      }

      setVoiceState('listening');
      setVoiceTranscript('');
      hasSpokenRef.current = false;
      silenceStartRef.current = Date.now();

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.error('Mic access error:', err);
      Alert.alert(
        'Microphone Error',
        'Could not start microphone. Please check your device permissions in Settings.',
        [{ text: 'OK' }]
      );
      setVoiceState('idle');
    }
  };

  async function stopRecording() {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    setVoiceState('processing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setVoiceState('idle');
        return;
      }
      await sendVoiceToBackend(uri);
    } catch (err) {
      console.error('Stop recording error:', err);
      setVoiceState('idle');
    }
  }

  const startVoiceNoteRecording = async () => {
    try {
      // Same dual-check as startRecording to handle Expo 52 permission schema
      let permission = await requestRecordingPermissionsAsync();
      let isGranted = permission.status === 'granted' || permission.granted === true;

      if (!isGranted && AudioModule?.requestRecordingPermissionsAsync) {
        permission = await AudioModule.requestRecordingPermissionsAsync();
        isGranted = permission.status === 'granted' || permission.granted === true;
      }

      if (!isGranted) {
        Alert.alert(
          'Microphone Permission Required',
          'Aranya needs microphone access to record voice messages. Please enable it in Settings → Apps → Aranya AI → Permissions.',
          [{ text: 'OK' }]
        );
        return;
      }

      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch (modeErr) {
        console.warn('setAudioModeAsync error:', modeErr);
      }

      setIsRecordingVoiceNote(true);
      setVoiceNoteDuration(0);
      voiceNoteTimerRef.current = setInterval(() => {
        setVoiceNoteDuration(p => p + 1);
      }, 1000);

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.error('Start voice note error:', err);
    }
  };

  const cancelVoiceNote = async () => {
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    setIsRecordingVoiceNote(false);
    setVoiceNoteDuration(0);
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
      } catch (e) {
        console.error('Error canceling recording:', e);
      }
    }
  };

  const sendVoiceNote = async () => {
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    
    const duration = voiceNoteDuration;
    setIsRecordingVoiceNote(false);
    setVoiceNoteDuration(0);

    if (recorderState.isRecording) {
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) {
          const tempMsgId = Date.now().toString();
          setMessages(prev => [...prev, {
            id: tempMsgId,
            text: '',
            isSender: true,
            isVoiceNote: true,
            isTranscribing: true,
            audio_uri: uri,
            voiceDuration: duration,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'sent',
          }]);
          
          await sendVoiceNoteToBackend(uri, tempMsgId);
        }
      } catch (e) {
        console.error('Error sending voice note:', e);
      }
    }
  };

  const sendVoiceNoteToBackend = async (uri: string, tempMsgId: string) => {
    setIsTyping(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const audioBlob = await response.blob();
        formData.append('audio', audioBlob, 'voice.webm');
      } else {
        formData.append('audio', {
          uri: uri,
          name: Platform.OS === 'android' ? 'voice.m4a' : 'voice.caf',
          type: Platform.OS === 'android' ? 'audio/m4a' : 'audio/x-caf',
        } as any);
      }

      formData.append('language', i18n.locale || 'hi');
      formData.append('user_id', 'demo_user_123');

      const response = await fetch(`${apiUrl}/api/voice-chat`, {
        method: 'POST',
        headers: {
          'X-Sarvam-API-Key': process.env.EXPO_PUBLIC_SARVAM_API_KEY || '',
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.error) {
        setMessages(prev => prev.map(m => m.id === tempMsgId ? { 
          ...m, 
          text: `Transcription failed: ${data.error}`,
          isTranscribing: false 
        } : m));
        return;
      }

      const cleanTranscript = (data.transcript || '').replace(/['"]+/g, '').trim();
      
      if (cleanTranscript && cleanTranscript.toLowerCase() !== 'not found') {
        setMessages(prev => prev.map(m => m.id === tempMsgId ? { 
          ...m, 
          text: cleanTranscript,
          isTranscribing: false,
          status: 'read' 
        } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === tempMsgId ? { 
          ...m, 
          text: "[Empty Voice Message]",
          isTranscribing: false,
          status: 'read' 
        } : m));
      }

      if (data.reply) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          isSender: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          audio_base64: data.audio_base64 || undefined,
          isVoiceNote: !!data.audio_base64,
          voiceDuration: data.audio_base64 ? Math.ceil(data.reply.length / 15) : undefined,
        }]);

        if (data.audio_base64) {
          try {
            await playBase64Audio(data.audio_base64);
          } catch (e) {
            console.error('Background audio playback error:', e);
          }
        }
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error('Upload voice note error:', e);
      const isTimeout = e.name === 'AbortError';
      setMessages(prev => prev.map(m => m.id === tempMsgId ? { 
        ...m, 
        text: isTimeout ? 'Server response timed out. Please try again.' : 'Connection error. Upload failed.', 
        isTranscribing: false 
      } : m));
    } finally {
      setIsTyping(false);
    }
  };

  const sendVoiceToBackend = async (uri: string) => {
    setVoiceState('processing');
    setVoiceTranscript('Connecting to server...');

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';

    // Wake up the server first (Render free tier goes to sleep)
    try {
      await fetch(`${apiUrl}/health`, { method: 'GET' });
    } catch (_) { /* ignore — just a wake ping */ }

    setVoiceTranscript('Processing your voice...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s for cold starts

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const audioBlob = await response.blob();
        console.log("Recorded Audio Blob Size (Web):", audioBlob.size, "bytes, mime:", audioBlob.type);
        
        if (audioBlob.size < 1000) {
          console.warn("Recorded voice file is empty or extremely quiet!");
          setVoiceState('speaking');
          setVoiceTranscript("Microphone recorded no sound. Please check your mic permissions.");
          clearTimeout(timeoutId);
          setTimeout(() => {
            if (voiceModeRef.current) {
              setVoiceState('idle');
              setTimeout(() => { if (voiceModeRef.current) startRecording(); }, 100);
            }
          }, 4500);
          return;
        }
        formData.append('audio', audioBlob, 'voice.webm');
      } else {
        // Native APK support
        console.log("Recorded Audio URI (Native):", uri);
        formData.append('audio', {
          uri: uri,
          name: Platform.OS === 'android' ? 'voice.m4a' : 'voice.caf',
          type: Platform.OS === 'android' ? 'audio/m4a' : 'audio/x-caf',
        } as any);
      }

      formData.append('language', i18n.locale || 'hi');
      formData.append('user_id', 'demo_user_123');
      if (userLocation?.lat && userLocation?.lon) {
        formData.append('lat', userLocation.lat.toString());
        formData.append('lon', userLocation.lon.toString());
      }

      const response = await fetch(`${apiUrl}/api/voice-chat`, {
        method: 'POST',
        headers: {
          'X-Sarvam-API-Key': process.env.EXPO_PUBLIC_SARVAM_API_KEY || '',
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.error("Failed to parse JSON response:", jsonErr);
        data = { error: `Server returned status ${response.status}` };
      }

      if (!response.ok || data.error) {
        const errMsg = data.error || `Server error (${response.status})`;
        setVoiceState('speaking');
        setVoiceTranscript(errMsg);
        setTimeout(() => {
          if (voiceModeRef.current) {
            setVoiceState('idle');
            setTimeout(() => { if (voiceModeRef.current) startRecording(); }, 100);
          }
        }, 4500);
        return;
      }

      // Show what user said
      const cleanTranscript = (data.transcript || '').replace(/['\"]+/g, '').trim();
      
      if (cleanTranscript && cleanTranscript.toLowerCase() !== 'not found') {
        setVoiceTranscript(cleanTranscript);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: cleanTranscript,
          isSender: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
        }]);
      } else {
        setVoiceTranscript('');
      }

      // Add AI reply to chat history
      if (data.reply) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          isSender: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          audio_base64: data.audio_base64 || undefined,
          isVoiceNote: !!data.audio_base64,
          voiceDuration: data.audio_base64 ? Math.ceil(data.reply.length / 15) : undefined,
        }]);
      }

      // Auto-play response audio
      if (data.audio_base64) {
        setVoiceState('speaking');
        setVoiceTranscript(data.reply || '');
        try {
          await playBase64Audio(data.audio_base64);
        } catch (e) { console.error('Voice playback error:', e); }
      } else if (data.reply) {
        setVoiceState('speaking');
        setVoiceTranscript(data.reply);
        const sarvamB64 = await fetchSarvamTTS(data.reply, i18n.locale);
        if (sarvamB64) {
          try { await playBase64Audio(sarvamB64); } catch (e) { console.error('Sarvam playback error:', e); }
        } else {
          try { await playFallbackAudio(data.reply, i18n.locale); } catch (e) { console.error('Fallback playback error:', e); }
        }
      }

      setVoiceState('idle');
      setTimeout(() => {
        if (voiceModeRef.current) startRecording();
      }, 100);

    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Voice chat error:', error);
      const isTimeout = error.name === 'AbortError';
      const errMsg = isTimeout
        ? 'Server is waking up... please wait a moment and try again.'
        : 'Network error. Please check your internet connection.';
      
      setVoiceState('speaking');
      setVoiceTranscript(errMsg);
      
      // Wait longer before retry so user can read the message
      setTimeout(() => {
        if (voiceModeRef.current) {
          setVoiceState('idle');
          // Don't auto-retry on connection errors — let user press mic again
        }
      }, 5000);
    }
  };


  const greetAndStart = async () => {
    setVoiceState('processing');
    setVoiceTranscript('Connecting...');
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Please give a very short 1-sentence friendly greeting to start our voice call.',
          user_id: 'demo_user_123',
          language: i18n.locale,
        }),
      });
      const data = await response.json();
      
      if (data.reply) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: data.reply,
          isSender: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          audio_base64: data.audio_base64 || undefined,
          isVoiceNote: !!data.audio_base64,
          voiceDuration: data.audio_base64 ? Math.ceil(data.reply.length / 15) : undefined,
        }]);

        if (data.audio_base64) {
          setVoiceState('speaking');
          setVoiceTranscript(data.reply);
          await playBase64Audio(data.audio_base64);
        } else if (data.reply) {
          setVoiceState('speaking');
          setVoiceTranscript(data.reply);
          await playFallbackAudio(data.reply, i18n.locale);
        }
      }
    } catch (e) {
      console.error('Greeting error', e);
    } finally {
      setVoiceState('idle');
      setTimeout(() => {
        if (voiceModeRef.current) startRecording();
      }, 100);
    }
  };

  const toggleVoiceMode = () => {
    const newState = !voiceMode;
    setVoiceMode(newState);
    setCallDuration(0);
    if (newState) {
      greetAndStart();
    } else {
      stopRecording();
      setVoiceState('idle');
    }
  };

  async function exitVoiceMode() {
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
      } catch (e) {
        console.error('Error stopping recording:', e);
      }
    }
    setVoiceMode(false);
    setIsVoiceMinimized(false);
    setVoiceState('idle');
    setVoiceTranscript('');
    setCallDuration(0);
  }

  const interruptAI = async () => {
    await stopActiveAudio();
    setVoiceState('listening');
    setVoiceTranscript('');
    hasSpokenRef.current = false;
    silenceStartRef.current = Date.now();
    try {
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch (modeErr) {
        console.warn('setAudioModeAsync error:', modeErr);
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.error('Interrupt start mic error:', err);
    }
  };

  // ═══════════════════════════════════════════════════════
  // VOICE MODE FULL-SCREEN (WhatsApp Style)
  // ═══════════════════════════════════════════════════════
  if (voiceMode && !isVoiceMinimized) {
    const isListening = voiceState === 'listening';
    const isSpeaking = voiceState === 'speaking';
    const isProcessing = voiceState === 'processing';

    return (
      <View style={vs.overlay}>
        <ImageBackground source={require('../../assets/images/bg.png')} style={vs.bg} imageStyle={vs.bgImage}>
          <View style={vs.topBar}>
            <Pressable onPress={() => setIsVoiceMinimized(true)} style={vs.iconBtn}>
              <ChevronDown color="#fff" size={28} />
            </Pressable>
            <View style={vs.topCenter}>
              <Text style={vs.nameSmall}>Aranya</Text>
              <View style={vs.encryption}>
                <Lock color="#8696a0" size={12} />
                <Text style={vs.encryptionText}>End-to-end encrypted</Text>
              </View>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Center — Avatar */}
          <View style={vs.center}>
            <Pressable 
              style={vs.avatarWrapper}
              onPress={() => {
                if (voiceState === 'speaking' || voiceState === 'processing') {
                  interruptAI();
                }
              }}
            >
              {(isListening || isSpeaking) && (
                <>
                  <Animated.View style={[vs.ripple, rippleStyle1]} />
                  <Animated.View style={[vs.ripple, rippleStyle2]} />
                </>
              )}
              <Animated.View entering={ZoomIn.duration(500)} style={[
                vs.avatarOuter,
                isSpeaking && vs.avatarPulseSpeaking,
                isListening && vs.avatarPulseListening,
              ]}>
                <Image source={require('../../assets/images/logo.png')} style={vs.avatarImg} contentFit="contain" />
              </Animated.View>
            </Pressable>

            {/* In WhatsApp, time appears here once connected */}
            <Text style={vs.timer}>{formatDuration(callDuration)}</Text>
            
            <Text style={vs.status}>
              {voiceState === 'idle' && 'Tap mic to resume'}
              {isListening && 'Listening...'}
              {isProcessing && 'Thinking...'}
              {isSpeaking && 'Speaking...'}
            </Text>

            {voiceTranscript ? (
              <Animated.View entering={FadeIn} style={vs.transcriptBubble}>
                <Text style={vs.transcriptText}>{"\"" + voiceTranscript + "\""}</Text>
              </Animated.View>
            ) : null}
          </View>

          {/* Bottom Pill Controls */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={vs.bottomContainer}>
            <View style={vs.pillContainer}>
              <Pressable style={vs.pillButton} onPress={exitVoiceMode}>
                <MessageSquare color="#fff" size={24} />
              </Pressable>
              
              <Pressable 
                style={[vs.pillButton, speakerOn ? vs.pillButtonActive : null]} 
                onPress={() => {
                  setSpeakerOn(!speakerOn);
                  setAudioModeAsync({
                    allowsRecording: true,
                    playsInSilentMode: true,
                    shouldRouteThroughEarpiece: speakerOn, // toggles between speaker/earpiece (speakerOn=true means we want speaker, so shouldRouteThroughEarpiece=false)
                  }).catch(() => {});
                }}
              >
                <Volume2 color={speakerOn ? "#111" : "#fff"} size={24} />
              </Pressable>
              
              <Pressable 
                style={[vs.pillButton, isListening ? vs.pillButtonActive : null]}
                onPress={() => {
                  if (isListening) stopRecording();
                  else if (isSpeaking || isProcessing) {
                    interruptAI();
                  }
                  else if (voiceState === 'idle') startRecording();
                }}
              >
                {isListening ? <Mic color="#111" size={24} /> : <MicOff color="#fff" size={24} />}
              </Pressable>
              
              <Pressable style={vs.endCallButton} onPress={exitVoiceMode}>
                <PhoneOff color="#fff" size={24} />
              </Pressable>
            </View>
          </Animated.View>
        </ImageBackground>
      </View>
    );
  }

  // ── Menu Handlers ──
  const handleClearChat = () => {
    setMenuVisible(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
        setMessages([{
          id: '1',
          text: 'नमस्ते! 🙏 मैं अरण्य हूँ, आपका AI कृषि मित्र। आज मैं आपकी फसल, मौसम या मंडी भाव में कैसे मदद कर सकता हूँ?',
          isSender: false,
          hasCallAction: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      }
      return;
    }
    
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          setMessages([{
            id: '1',
            text: 'नमस्ते! 🙏 मैं अरण्य हूँ, आपका AI कृषि मित्र। आज मैं आपकी फसल, मौसम या मंडी भाव में कैसे मदद कर सकता हूँ?',
            isSender: false,
            hasCallAction: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }]);
        }},
      ]
    );
  };

  const handleReport = () => {
    setMenuVisible(false);
    setReportText('');
    setReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!reportText.trim()) return;
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      await fetch(`${apiUrl}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportText, user_id: 'demo_user_123', timestamp: new Date().toISOString() }),
      });
    } catch (e) {
      console.log('Report sent (or offline, ignoring):', e);
    }
    setReportModalVisible(false);
    if (Platform.OS === 'web') {
      window.alert('Your report has been submitted. Our team will review it shortly.');
    } else {
      Alert.alert('Thank You', 'Your report has been submitted. Our team will review it shortly.');
    }
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        try {
          await logoutUser();
          await AsyncStorage.clear();
        } catch (e) {}
        router.replace('/sign-in');
      }
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => {
          try {
            await logoutUser();
            await AsyncStorage.clear();
          } catch (e) {}
          router.replace('/sign-in');
        }},
      ]
    );
  };

  // ═══════════════════════════════════════════════════════
  // NORMAL CHAT MODE
  // ═══════════════════════════════════════════════════════
  return (
    <SafeAreaView style={cs.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {/* Permissions Onboarding — shown once on first launch */}
      {showPermissions && (
        <PermissionsOnboarding onDone={async () => {
          setShowPermissions(false);
          await saveUserProfile({ permissionsShown: true });
          await fetchLocationAndWeather();
        }} />
      )}

      {/* Soil Labs Bottom Sheet */}
      <SoilLabsSheet
        visible={showSoilLabs}
        labs={soilLabs}
        portalUrl={soilLabsPortalUrl}
        onClose={() => setShowSoilLabs(false)}
      />

      {/* Soil Health Card Modal */}
      <SoilHealthCardModal
        visible={showSoilHealthCard}
        profile={userProfile}
        onClose={() => setShowSoilHealthCard(false)}
        onSave={async (data) => {
          const updated = { ...userProfile, ...data };
          setUserProfile(updated);
          await saveUserProfile(data);
          setShowSoilHealthCard(false);
          Alert.alert('✅ Saved!', 'Soil health data saved. Aranya will now give you personalised fertilizer advice!');
        }}
      />

      <KeyboardAvoidingView style={cs.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={cs.header}>
          <View style={cs.headerLeft}>
            <View style={cs.avatar}>
              <Image source={require('../../assets/images/logo.png')} style={cs.avatarImage} contentFit="contain" />
            </View>
            <View>
              <Text style={cs.headerName}>Aranya</Text>
              {isTyping ? (
                <Animated.Text entering={FadeIn} style={[cs.headerStatus, { color: '#fb923c' }]}>typing...</Animated.Text>
              ) : (
                <Animated.Text entering={FadeIn} style={cs.headerStatus}>Online</Animated.Text>
              )}
            </View>
          </View>
          <View style={cs.headerRight}>
            <Pressable style={cs.phoneButton} onPress={toggleVoiceMode}>
              <Phone color="#000" size={22} />
            </Pressable>
            <Pressable style={cs.menuButton} onPress={() => setMenuVisible(true)}>
              <MoreVertical color="#000" size={22} />
            </Pressable>
          </View>
        </View>

        {/* Minimized Call Bar */}
        {voiceMode && isVoiceMinimized && (
          <Pressable style={cs.activeCallBar} onPress={() => setIsVoiceMinimized(false)}>
            <Text style={cs.activeCallText}>Tap to return to call {formatDuration(callDuration)}</Text>
          </Pressable>
        )}

        {/* Dropdown Menu */}
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={cs.menuOverlay} onPress={() => setMenuVisible(false)}>
            <Animated.View entering={FadeIn.duration(150)} style={cs.menuDropdown}>
              {/* Live weather toggler */}
              <Pressable style={cs.menuItem} onPress={() => { setMenuVisible(false); setShowWeatherCard(v => !v); }}>
                <CloudSun color="#374151" size={18} />
                <Text style={cs.menuItemText}>Weather Report</Text>
              </Pressable>
              <View style={cs.menuDivider} />

              {/* Nearest Soil Labs */}
              <Pressable style={cs.menuItem} onPress={async () => {
                setMenuVisible(false);
                if (soilLabs.length === 0 && userLocation) {
                  const result = await fetchSoilLabs(userLocation.lat, userLocation.lon, 5);
                  if (result) { setSoilLabs(result.labs || []); setSoilLabsPortalUrl(result.portal_url || soilLabsPortalUrl); }
                }
                setShowSoilLabs(true);
              }}>
                <TestTube color="#374151" size={18} />
                <Text style={cs.menuItemText}>Soil Testing Labs</Text>
              </Pressable>
              <View style={cs.menuDivider} />

              {/* Soil Health Card */}
              <Pressable style={cs.menuItem} onPress={() => { setMenuVisible(false); setShowSoilHealthCard(true); }}>
                <Leaf color="#374151" size={18} />
                <Text style={cs.menuItemText}>Soil Health Card</Text>
              </Pressable>
              <View style={cs.menuDivider} />

              <Pressable style={cs.menuItem} onPress={handleClearChat}>
                <Trash2 color="#374151" size={18} />
                <Text style={cs.menuItemText}>Clear Chat</Text>
              </Pressable>
              <View style={cs.menuDivider} />
              
              <Pressable style={cs.menuItem} onPress={handleReport}>
                <Flag color="#374151" size={18} />
                <Text style={cs.menuItemText}>Report Issue</Text>
              </Pressable>
              <View style={cs.menuDivider} />
              
              <Pressable style={cs.menuItem} onPress={handleLogout}>
                <LogOut color="#ef4444" size={18} />
                <Text style={[cs.menuItemText, { color: '#ef4444' }]}>Logout</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* Report Issue Modal */}
        <Modal visible={reportModalVisible} transparent animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
          <View style={cs.reportOverlay}>
            <Animated.View entering={FadeIn.duration(200)} style={cs.reportCard}>
              <Text style={cs.reportTitle}>Report an Issue</Text>
              <Text style={cs.reportSubtitle}>Describe what went wrong and we will look into it.</Text>
              <TextInput
                style={cs.reportInput}
                placeholder="Describe the issue..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                value={reportText}
                onChangeText={setReportText}
                autoFocus
              />
              <View style={cs.reportActions}>
                <Pressable style={cs.reportCancelBtn} onPress={() => setReportModalVisible(false)}>
                  <Text style={cs.reportCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[cs.reportSubmitBtn, !reportText.trim() && { opacity: 0.4 }]} onPress={submitReport}>
                  <Text style={cs.reportSubmitText}>Submit</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Chat Area with Premium Warm-Sand Background */}
        <View style={cs.chatArea}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={cs.chatContent}
            onContentSizeChange={() => {
              if (isNearBottomRef.current) {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }
            }}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
              const nearBottom = distanceFromBottom < 80;
              isNearBottomRef.current = nearBottom;
              setShowScrollDown(!nearBottom && contentSize.height > layoutMeasurement.height + 100);
            }}
            scrollEventThrottle={100}
          >
            <View style={cs.dateBadgeContainer}>
              <View style={cs.dateBadge}><Text style={cs.dateText}>Today</Text></View>
            </View>

            {/* Expandable Weather Card — shown when user taps temp badge */}
            {showWeatherCard && weatherData && (
              <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 12 }}>
                <WeatherCard weather={weatherData} onClose={() => setShowWeatherCard(false)} />
              </Animated.View>
            )}

            {messages.map((msg) => (
              <Animated.View key={msg.id} entering={FadeInUp.delay(50).duration(300).springify()}
                style={[cs.messageBubble, msg.isSender ? cs.sentBubble : cs.receivedBubble]}>
                
                {msg.image_base64 && (
                  <Image source={{ uri: msg.image_base64 }} style={cs.messageImage} contentFit="cover" />
                )}
                
                {msg.isDocument && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: msg.isSender ? '#10b981' : '#f3f4f6', borderRadius: 8, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: msg.isSender ? '#059669' : '#e5e7eb' }}>
                    <FileText color={msg.isSender ? '#ffffff' : '#8b5cf6'} size={28} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: msg.isSender ? '#ffffff' : '#374151' }} numberOfLines={1}>
                        {msg.doc_name || 'Document'}
                      </Text>
                      <Text style={{ fontSize: 11, color: msg.isSender ? '#a7f3d0' : '#6b7280', marginTop: 2 }}>
                        PDF / Document
                      </Text>
                    </View>
                  </View>
                )}
                
                {msg.isVoiceNote ? (
                  <View style={cs.voiceMessageContainer}>
                    <Pressable 
                      style={cs.voicePlayButton} 
                      onPress={() => playAudio({ uri: msg.audio_uri, base64: msg.audio_base64 }, msg.id)}
                    >
                      {playingId === msg.id ? (
                        <Pause color={msg.isSender ? "#ffffff" : "#17c690"} size={16} />
                      ) : (
                        <Play color={msg.isSender ? "#ffffff" : "#4b5563"} size={16} style={{ marginLeft: 2 }} />
                      )}
                    </Pressable>
                    
                    <View style={cs.voiceContentColumn}>
                      <View style={cs.voiceWaveformRow}>
                        {msg.isTranscribing ? (
                          <View style={cs.voiceLoadingRow}>
                            <ActivityIndicator size="small" color={msg.isSender ? "#ffffff" : "#17c690"} style={{ marginRight: 6 }} />
                            <Text style={[cs.voiceTranscribingText, msg.isSender && { color: '#ffedd5' }]}>Transcribing voice...</Text>
                          </View>
                        ) : (
                          <View style={cs.voiceWaveform}>
                            {[4, 10, 14, 8, 18, 12, 6, 10, 16, 12, 6, 14, 8, 10, 16, 12, 4].map((h, i) => (
                              <View key={i} style={[
                                cs.audioBar, 
                                {
                                  height: h,
                                  backgroundColor: playingId === msg.id 
                                    ? (msg.isSender ? '#ffedd5' : '#17c690') 
                                    : (msg.isSender ? '#fde047' : '#9ca3af'),
                                }
                              ]} />
                            ))}
                          </View>
                        )}
                      </View>
                      
                      <View style={cs.voiceSubRow}>
                        <Text style={[cs.voiceDurationText, msg.isSender ? { color: '#ffedd5' } : { color: '#6b7280' }]}>
                          {playingId === msg.id ? 'Playing' : msg.voiceDuration ? formatDuration(msg.voiceDuration) : '0:00'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : msg.isLocation ? (
                  <View style={{ width: 240, overflow: 'hidden', borderRadius: 12, backgroundColor: msg.isSender ? '#059669' : '#ffffff', borderWidth: 1, borderColor: msg.isSender ? '#047857' : '#e5e7eb' }}>
                    <ImageBackground 
                      source={{ uri: 'https://i.ibb.co/n0N1tWz/map-placeholder.jpg' }} 
                      style={{ width: '100%', height: 130, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e5e7eb' }}
                      imageStyle={{ opacity: 0.8 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(16, 185, 129, 0.25)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}>
                        <MapPin color="#059669" size={26} fill="#10b981" />
                      </View>
                    </ImageBackground>
                    <View style={{ padding: 12, backgroundColor: msg.isSender ? '#10b981' : '#ffffff' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: msg.isSender ? '#ffffff' : '#1f2937', marginBottom: 2 }} numberOfLines={1}>
                        Location Shared
                      </Text>
                      <Text style={{ fontSize: 13, color: msg.isSender ? '#d1fae5' : '#6b7280' }} numberOfLines={1}>
                        {msg.locationLabel || 'Current Location'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  !!msg.text && (
                    <Text style={msg.isSender ? cs.sentText : cs.receivedText}>{renderFormattedText(msg.text, msg.isSender)}</Text>
                  )
                )}

                {msg.isVoiceNote && !msg.isTranscribing && !!msg.text && (
                  <View style={[cs.transcriptContainer, msg.isSender ? cs.senderTranscriptBg : cs.receivedTranscriptBg]}>
                    <Text style={[cs.transcriptHeaderLabel, msg.isSender ? { color: '#ffedd5' } : { color: '#17c690' }]}>Transcript</Text>
                    <Text style={msg.isSender ? cs.sentText : cs.receivedText}>{renderFormattedText(msg.text, msg.isSender)}</Text>
                  </View>
                )}
                {msg.hasCallAction && (
                  <Pressable style={cs.callActionButton} onPress={toggleVoiceMode}>
                    <Phone color="#10b981" size={16} />
                    <Text style={cs.callActionText}>बोलकर बात करें (Voice Chat)</Text>
                  </Pressable>
                )}
                <View style={cs.messageFooter}>
                  <Text style={msg.isSender ? cs.sentTime : cs.receivedTime}>{msg.timestamp || ''}</Text>
                  {msg.isSender && msg.status === 'sent' && <Check color="#ffedd5" size={14} style={cs.tickIcon} />}
                  {msg.isSender && msg.status === 'read' && <CheckCheck color="#34B7F1" size={15} style={cs.tickIcon} />}
                </View>
              </Animated.View>
            ))}



            {isTyping && (
              <Animated.View entering={FadeIn} style={[cs.messageBubble, cs.receivedBubble, { paddingVertical: 16 }]}>
                <View style={cs.typingDots}>
                  <View style={[cs.dot, { opacity: 0.4 }]} />
                  <View style={[cs.dot, { opacity: 0.6 }]} />
                  <View style={[cs.dot, { opacity: 0.9 }]} />
                </View>
              </Animated.View>
            )}
          </ScrollView>

          {/* WhatsApp-style Scroll to Bottom FAB */}
          {showScrollDown && (
            <Pressable
              style={cs.scrollDownFab}
              onPress={() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
                setShowScrollDown(false);
              }}
            >
              <ChevronDown color="#6b7280" size={22} />
            </Pressable>
          )}
        </View>

        {/* Image Preview */}
        {selectedImage && (
          <View style={cs.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={cs.imagePreview} contentFit="cover" />
            <Pressable style={cs.removeImageBtn} onPress={() => setSelectedImage(null)}>
              <X color="#fff" size={14} />
            </Pressable>
          </View>
        )}

        {/* Document Preview */}
        {selectedDoc && (
          <View style={cs.imagePreviewContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 10, marginRight: 40, width: '90%' }}>
              <FileText color="#8b5cf6" size={24} style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' }} numberOfLines={1}>
                {selectedDoc.name}
              </Text>
            </View>
            <Pressable style={cs.removeImageBtn} onPress={() => setSelectedDoc(null)}>
              <X color="#fff" size={14} />
            </Pressable>
          </View>
        )}


        {/* Suggestion Chips (only when chat is fresh) */}
        {messages.length <= 1 && !isRecordingVoiceNote && (
          <Animated.View entering={FadeIn.duration(300)} style={cs.chipRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.chipScroll}>
              <Pressable style={cs.chip} onPress={() => sendMessage('आज मेरे गांव में मौसम कैसा रहेगा?')}>
                <Text style={cs.chipEmoji}>🌦️</Text>
                <Text style={cs.chipText}>मौसम</Text>
              </Pressable>
              <Pressable style={cs.chip} onPress={() => sendMessage('मंडी में आज का ताज़ा भाव क्या है?')}>
                <Text style={cs.chipEmoji}>🌾</Text>
                <Text style={cs.chipText}>मंडी भाव</Text>
              </Pressable>
              <Pressable style={cs.chip} onPress={() => sendMessage('मेरी फसल में बीमारी लग गई है, क्या उपाय करूं?')}>
                <Text style={cs.chipEmoji}>🐛</Text>
                <Text style={cs.chipText}>फसल देखभाल</Text>
              </Pressable>
              <Pressable style={cs.chip} onPress={() => sendMessage('किसानों के लिए कौन सी सरकारी योजनाएं हैं?')}>
                <Text style={cs.chipEmoji}>📜</Text>
                <Text style={cs.chipText}>योजनाएं</Text>
              </Pressable>
              <Pressable style={cs.chip} onPress={() => sendMessage('मेरे खेत की मिट्टी की जांच कैसे करवाऊं?')}>
                <Text style={cs.chipEmoji}>🧪</Text>
                <Text style={cs.chipText}>मिट्टी जांच</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        )}

        {/* Input */}
        <View style={cs.inputArea}>
          {isRecordingVoiceNote ? (
            <Animated.View entering={FadeIn} style={cs.recordingContainer}>
              <View style={cs.recordingInfo}>
                <Animated.View style={[cs.redDot, redDotStyle]} />
                <Text style={cs.recordingText}>Recording {formatDuration(voiceNoteDuration)}</Text>
              </View>
              <Pressable style={cs.cancelVoiceNoteBtn} onPress={cancelVoiceNote}>
                <Text style={cs.cancelVoiceNoteText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={cs.inputContainer}>
              <TextInput style={cs.textInput} placeholder="अरण्य को संदेश लिखें..." placeholderTextColor="#6b7280"
                value={inputText} onChangeText={setInputText} onSubmitEditing={handleSend} />
              <Pressable style={cs.iconButton} onPress={() => setAttachmentSheetVisible(true)}>
                <Paperclip color="#4b5563" size={20} />
              </Pressable>
              <Pressable style={cs.iconButton} onPress={() => setCameraModalVisible(true)}>
                <CameraIcon color="#4b5563" size={20} />
              </Pressable>
            </View>
          )}
          {isRecordingVoiceNote ? (
            <Pressable style={cs.sendButton} onPress={sendVoiceNote}>
              <Send color="#ffffff" size={20} style={{ marginLeft: -2, marginTop: 2 }} />
            </Pressable>
          ) : inputText.trim().length > 0 || selectedImage || selectedDoc ? (
            <Pressable style={cs.sendButton} onPress={handleSend}>
              <Send color="#ffffff" size={20} style={{ marginLeft: -2, marginTop: 2 }} />
            </Pressable>
          ) : (
            <Pressable style={cs.sendButton} onPress={startVoiceNoteRecording}>
              <Mic color="#ffffff" size={24} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* WhatsApp Custom Camera Modal */}
      <Modal visible={cameraModalVisible} animationType="slide" transparent={false} onRequestClose={() => setCameraModalVisible(false)}>
        <View style={cms.container}>
          {/* Header */}
          <View style={cms.header}>
            <Pressable style={cms.iconBtn} onPress={() => setCameraModalVisible(false)}>
              <X color="#fff" size={28} />
            </Pressable>
            <Pressable style={cms.iconBtn} onPress={() => setFlashMode(flashMode === 'on' ? 'off' : 'on')}>
              {flashMode === 'on' ? <Zap color="#eab308" size={24} /> : <ZapOff color="#fff" size={24} />}
            </Pressable>
          </View>

          {/* Viewfinder */}
          <View style={cms.viewfinder}>
            {hasCameraPermission && !cameraError ? (
              <CameraView 
                style={cms.viewfinderImage} 
                facing={cameraType} 
                flash={flashMode}
                ref={cameraRef}
                onMountError={(err) => {
                  console.log('Camera mount error:', err);
                  setCameraError(err.message || 'Error starting camera source');
                }}
              />
            ) : (
              <View style={cms.noPermissionContainer}>
                {cameraError ? (
                  <Text style={cms.noPermissionText}>Camera source busy or unavailable</Text>
                ) : (
                  <Text style={cms.noPermissionText}>Requesting camera permission...</Text>
                )}
              </View>
            )}
            <View style={cms.viewfinderOverlay}>
              <View style={cms.focusRing} />
            </View>
          </View>

          {/* Gallery strip */}
          <View style={cms.galleryContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cms.galleryScroll}>
              {galleryPhotos.map((item) => (
                <Pressable 
                  key={item.id} 
                  style={cms.galleryItem}
                  onPress={() => {
                    setSelectedImage(item.uri);
                    setCameraModalVisible(false);
                  }}
                >
                  <Image source={{ uri: item.uri }} style={cms.galleryImage} />
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Shutter controls */}
          <View style={cms.shutterRow}>
            {/* Open Gallery */}
            <Pressable 
              style={cms.controlBtn} 
              onPress={async () => {
                const options: ImagePicker.ImagePickerOptions = {
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true, quality: 0.5, base64: true,
                };
                const result = await ImagePicker.launchImageLibraryAsync(options);
                if (!result.canceled && result.assets?.[0]?.base64) {
                  setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
                  setCameraModalVisible(false);
                }
              }}
            >
              <ImageIcon color="#fff" size={26} />
            </Pressable>

            {/* Shutter */}
            <Pressable 
              style={cms.shutterOuter}
              onPress={takePicture}
            >
              <View style={cms.shutterInner} />
            </Pressable>

            {/* Flip camera */}
            <Pressable style={cms.controlBtn} onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}>
              <RotateCw color="#fff" size={26} />
            </Pressable>
          </View>

          {/* Mode Selector */}
          <View style={cms.modeRow}>
            <Pressable onPress={() => setCameraMode('video')}>
              <Text style={[cms.modeText, cameraMode === 'video' && cms.modeTextActive]}>Video</Text>
            </Pressable>
            <View style={cms.modePill}>
              <Text style={[cms.modeText, cameraMode === 'photo' && cms.modeTextActive]}>Photo</Text>
            </View>
            <Pressable onPress={() => setCameraMode('videonote')}>
              <Text style={[cms.modeText, cameraMode === 'videonote' && cms.modeTextActive]}>Video note</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* WhatsApp Attachment Sheet Modal */}
      <Modal
        visible={attachmentSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachmentSheetVisible(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' }} 
          onPress={() => setAttachmentSheetVisible(false)}
        >
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
            {/* Header / Drag indicator */}
            <View style={{ width: 40, height: 5, backgroundColor: '#e5e7eb', borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
            
            {/* Grid Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              
              {/* Document Option */}
              <Pressable 
                style={{ alignItems: 'center', marginHorizontal: 12, marginVertical: 8, width: 80 }}
                onPress={pickDocument}
              >
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }}>
                  <FileText color="#ffffff" size={24} />
                </View>
                <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>Document</Text>
              </Pressable>

              {/* Camera Option */}
              <Pressable 
                style={{ alignItems: 'center', marginHorizontal: 12, marginVertical: 8, width: 80 }}
                onPress={() => {
                  setAttachmentSheetVisible(false);
                  setCameraModalVisible(true);
                }}
              >
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#ec4899', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#ec4899', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }}>
                  <CameraIcon color="#ffffff" size={24} />
                </View>
                <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>Camera</Text>
              </Pressable>

              {/* Gallery Option */}
              <Pressable 
                style={{ alignItems: 'center', marginHorizontal: 12, marginVertical: 8, width: 80 }}
                onPress={() => {
                  setAttachmentSheetVisible(false);
                  pickImage(false);
                }}
              >
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }}>
                  <ImageIcon color="#ffffff" size={24} />
                </View>
                <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>Gallery</Text>
              </Pressable>

              {/* Location Option */}
              <Pressable 
                style={{ alignItems: 'center', marginHorizontal: 12, marginVertical: 8, width: 80 }}
                onPress={shareLocation}
              >
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }}>
                  <MapPin color="#ffffff" size={24} />
                </View>
                <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>Location</Text>
              </Pressable>

            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════
// VOICE SCREEN STYLES (WhatsApp Call Style)
// ═══════════════════════════════════════════════════════
const vs = StyleSheet.create({
  overlay: { 
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    width: '100%', height: '100%',
    backgroundColor: '#0b141a',
  },
  bg: { flex: 1, width: '100%', height: '100%' },
  bgImage: { opacity: 0.05, resizeMode: 'cover', width: '100%', height: '100%' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  iconBtn: { padding: 8 },
  topCenter: { alignItems: 'center' },
  nameSmall: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: '#e9edef' },
  encryption: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  encryptionText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#8696a0' },
  
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarWrapper: {
    width: 320, height: 320, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, position: 'relative',
  },
  ripple: {
    position: 'absolute',
    width: 240, height: 240, borderRadius: 120,
    zIndex: -1,
  },
  avatarOuter: {
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: '#1f2c34', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPulseSpeaking: { borderWidth: 3, borderColor: '#17c690' },
  avatarPulseListening: { borderWidth: 3, borderColor: '#fb923c' },
  avatarImg: { width: 160, height: 160 },
  
  timer: { fontSize: 18, fontFamily: 'Inter_500Medium', color: '#8696a0', marginBottom: 8 },
  status: { fontSize: 16, fontFamily: 'Inter_400Regular', color: '#8696a0' },
  
  transcriptBubble: {
    marginTop: 24, paddingHorizontal: 24, maxWidth: '90%',
  },
  transcriptText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#e9edef', textAlign: 'center', fontStyle: 'italic' },
  
  bottomContainer: { 
    position: 'absolute', bottom: 40, left: 0, right: 0,
    paddingHorizontal: 20 
  },
  pillContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    backgroundColor: '#1b2024', borderRadius: 40, paddingVertical: 8, paddingHorizontal: 8,
  },
  pillButton: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#303b41',
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 6,
  },
  pillButtonActive: { backgroundColor: '#e9edef' },
  endCallButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
  },
});

const cms = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'space-between', paddingBottom: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 40, height: 80,
  },
  iconBtn: { padding: 8 },
  viewfinder: {
    flex: 1, marginHorizontal: 8, borderRadius: 24, overflow: 'hidden',
    position: 'relative', backgroundColor: '#111',
  },
  viewfinderImage: { width: '100%', height: '100%' },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
  },
  focusRing: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed' as any,
  },
  noPermissionContainer: {
    flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
  },
  noPermissionText: {
    color: '#aaa', fontSize: 16, fontFamily: 'Inter_500Medium',
  },
  galleryContainer: { height: 80, marginVertical: 12 },
  galleryScroll: { paddingHorizontal: 16, gap: 10 },
  galleryItem: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  galleryImage: { width: '100%', height: '100%' },
  shutterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    marginVertical: 16,
  },
  controlBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterOuter: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 6, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff',
  },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
    height: 48,
  },
  modeText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#888' },
  modeTextActive: { color: '#fff' },
  modePill: {
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20,
  },
});

// ═══════════════════════════════════════════════════════
// CHAT SCREEN STYLES
// ═══════════════════════════════════════════════════════
const cs = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#ffffff'
  },
  activeCallBar: {
    backgroundColor: '#17c690', paddingVertical: 10, alignItems: 'center', justifyContent: 'center'
  },
  activeCallText: {
    color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 14
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  headerName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  headerStatus: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#17c690' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phoneButton: { padding: 8 },
  menuButton: { padding: 8 },
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', alignItems: 'flex-end',
  },
  menuDropdown: {
    marginTop: 60, marginRight: 16, backgroundColor: '#ffffff', borderRadius: 12,
    paddingVertical: 6, minWidth: 180,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 8,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  menuItemText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#374151' },
  menuDivider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 12 },
  reportOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  reportCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, elevation: 12,
  },
  reportTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#111827', marginBottom: 6 },
  reportSubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  reportInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14,
    fontSize: 15, fontFamily: 'Inter_400Regular', color: '#111827',
    minHeight: 100, textAlignVertical: 'top', marginBottom: 20,
  },
  reportActions: { flexDirection: 'row', gap: 12 },
  reportCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center',
  },
  reportCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  reportSubmitBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#fc865a', alignItems: 'center',
  },
  reportSubmitText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  chatArea: { flex: 1, backgroundColor: '#FAF8F5', position: 'relative' as any },
  chatContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  dateBadgeContainer: { alignItems: 'center', marginVertical: 16 },
  scrollDownFab: {
    position: 'absolute', bottom: 12, right: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 5,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  dateBadge: {
    backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  dateText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#374151' },
  messageBubble: {
    maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  receivedBubble: { backgroundColor: '#ffffff', alignSelf: 'flex-start', borderTopLeftRadius: 4 },
  receivedText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#374151', lineHeight: 22 },
  sentBubble: { backgroundColor: '#fc865a', alignSelf: 'flex-end', borderTopRightRadius: 4 },
  sentText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#ffffff', lineHeight: 22 },
  messageImage: { width: 220, height: 220, borderRadius: 8, marginBottom: 8 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6 },
  sentTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  receivedTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9ca3af' },
  tickIcon: { marginLeft: 4 },
  callActionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f0fdf4', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#d1fae5',
  },
  callActionText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#10b981', marginLeft: 8 },
  // Audio player (WhatsApp-style waveform)
  audioButton: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    backgroundColor: '#f0fdf4', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    gap: 8,
  },
  audioWaveform: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  audioBar: { width: 3, borderRadius: 2 },
  audioLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#6b7280' },
  // Typing
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9ca3af' },
  // Image preview
  imagePreviewContainer: {
    padding: 12, paddingHorizontal: 16, backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row',
  },
  imagePreview: { width: 60, height: 60, borderRadius: 8 },
  removeImageBtn: {
    position: 'absolute', top: 6, left: 68,
    backgroundColor: 'rgba(0,0,0,0.6)', width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  // Input
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24, backgroundColor: '#ffffff',
  },
  inputContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', borderRadius: 24, paddingHorizontal: 16, minHeight: 48,
    marginRight: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  textInput: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#111827', paddingVertical: 12,
    // @ts-ignore
    outlineStyle: 'none',
  },
  iconButton: { padding: 8, marginLeft: 4 },
  sendButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#17c690',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#17c690', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  // Inline recording container
  recordingContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fee2e2', borderRadius: 24, paddingHorizontal: 16, minHeight: 48,
    marginRight: 12, borderWidth: 1, borderColor: '#fecaca',
  },
  recordingInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  recordingText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#dc2626' },
  cancelVoiceNoteBtn: { padding: 6 },
  cancelVoiceNoteText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#9ca3af' },
  // Unified Voice Message Bubble Styles
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
    minWidth: 200,
  },
  voicePlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceContentColumn: {
    flex: 1,
    gap: 4,
  },
  voiceWaveformRow: {
    height: 24,
    justifyContent: 'center',
  },
  voiceLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceTranscribingText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  voiceSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voiceDurationText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  transcriptContainer: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  senderTranscriptBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  receivedTranscriptBg: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  transcriptHeaderLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Suggestion Chips (above input bar)
  chipRow: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingVertical: 10,
  },
  chipScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#d1fae5',
    gap: 6,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#065f46',
  },
});
