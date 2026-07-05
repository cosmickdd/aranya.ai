import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ImageBackground, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Phone, Paperclip, Camera, Send, Check, CheckCheck, X, Mic, Volume2, PhoneOff, Play, Pause, MoreVertical, Trash2, Flag, LogOut, ChevronDown, Lock, UserPlus, MoreHorizontal, Video, MicOff, MessageSquare } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, FadeInDown, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../lib/i18n';

// ═══════════════════════════════════════════════════════
// AUDIO HELPERS — using Web Audio API for reliable playback
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
function getAudioContext(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

async function playBase64Audio(base64: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const arrayBuffer = base64ToArrayBuffer(base64);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => resolve();
      source.start(0);
    } catch (e) {
      console.error('Audio playback error:', e);
      reject(e);
    }
  });
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
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Voice Mode
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoiceMinimized, setIsVoiceMinimized] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const hasSpokenRef = useRef(false);

  // Ripple Animations
  const ripple1 = useSharedValue(1);
  const ripple2 = useSharedValue(1);

  useEffect(() => {
    if (voiceState === 'listening' || voiceState === 'speaking') {
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
  }, [voiceState]);

  const rippleColor = voiceState === 'speaking' ? 'rgba(23, 198, 144, 0.2)' : 'rgba(251, 146, 60, 0.2)';

  const rippleStyle1 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: ripple1.value }],
      opacity: 1 - (ripple1.value - 1) / 0.6,
      backgroundColor: rippleColor,
    };
  });

  const rippleStyle2 = useAnimatedStyle(() => {
    return {
      transform: [{ scale: ripple2.value }],
      opacity: 1 - (ripple2.value - 1) / 0.6,
      backgroundColor: rippleColor,
    };
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Namaste! 🙏 I am Aranya, your AI farming assistant. How can I help you with your crops, weather, or market prices today?',
      isSender: false,
      hasCallAction: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  // Call timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (voiceMode) {
      interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [voiceMode]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Audio Playback ──
  const playAudio = async (audioBase64: string, msgId: string) => {
    try {
      if (playingId === msgId) { setPlayingId(null); return; }
      setPlayingId(msgId);
      await playBase64Audio(audioBase64);
      setPlayingId(null);
    } catch (error) {
      console.error('Audio error:', error);
      setPlayingId(null);
    }
  };

  // ── Image Picker ──
  const pickImage = async (useCamera = false) => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, quality: 0.5, base64: true,
      };
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { alert('Camera permission needed!'); return; }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled && result.assets?.[0]?.base64) {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) { console.error("Image pick error:", error); }
  };

  // ── Send Message (shared by chat and voice) ──
  const sendMessage = useCallback(async (text: string, imgB64?: string | null) => {
    if (!text.trim() && !imgB64) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isSender: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      image_base64: imgB64 || undefined,
    };
    setMessages(prev => [...prev, newMsg]);
    setIsTyping(true);
    if (voiceMode) setVoiceState('processing');

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          user_id: 'demo_user_123',
          language: i18n.locale,
          image_base64: imgB64,
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
    setInputText('');
    setSelectedImage(null);
    sendMessage(text, img);
  };

  // ── Voice Recording via Expo AV (Universal Web/iOS/Android) ──
  const recordingRef = useRef<Audio.Recording | null>(null);
  const silenceStartRef = useRef<number>(Date.now());

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('Microphone access is required for voice chat. Please allow mic access.');
        setVoiceState('idle');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setVoiceState('listening');
      setVoiceTranscript('');
      hasSpokenRef.current = false;
      silenceStartRef.current = Date.now();

      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        
        // Metering provides dB from -160 (silent) to 0 (loudest)
        const metering = status.metering || -160;
        const now = Date.now();

        // -35 dB is a typical threshold for speaking voice
        if (metering > -35) {
          silenceStartRef.current = now;
          if (!hasSpokenRef.current) hasSpokenRef.current = true;
        } else {
          // 1.5 seconds of silence after speaking = stop
          if (hasSpokenRef.current && (now - silenceStartRef.current > 1500)) {
            stopRecording();
          } 
          // 5 seconds of total silence without ever speaking = stop
          else if (!hasSpokenRef.current && (now - silenceStartRef.current > 5000)) {
            stopRecording();
          }
        }
      });
      
      // Update metering 10 times a second for fast VAD
      recording.setProgressUpdateInterval(100);

    } catch (err) {
      console.error('Mic access error:', err);
      alert('Microphone access is required for voice chat. Please allow mic access.');
      setVoiceState('idle');
    }
  };

  const stopRecording = async () => {
    if (recordingRef.current) {
      setVoiceState('processing');
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        
        if (!hasSpokenRef.current || !uri) {
          setVoiceState('idle');
          return;
        }
        
        await sendVoiceToBackend(uri);
      } catch (err) {
        console.error('Stop recording error:', err);
        setVoiceState('idle');
      }
    }
  };

  const sendVoiceToBackend = async (uri: string) => {
    setVoiceState('processing');
    setVoiceTranscript('Processing your voice...');

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const audioBlob = await response.blob();
        formData.append('audio', audioBlob, 'voice.webm');
      } else {
        // Native APK / IPA support
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
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        setVoiceTranscript(data.error);
        setVoiceState('idle');
        return;
      }

      // Show what user said
      // Show what user said
      const cleanTranscript = (data.transcript || '').replace(/['"]+/g, '').trim();
      
      if (cleanTranscript && cleanTranscript.toLowerCase() !== 'not found') {
        setVoiceTranscript(cleanTranscript);
        // Add user message to chat history
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: cleanTranscript,
          isSender: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
        }]);
      } else {
        // Fallback if it detected silence despite VAD
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
        }]);
      }

      // Auto-play response audio
      if (data.audio_base64) {
        setVoiceState('speaking');
        setVoiceTranscript(data.reply || '');
        try {
          await playBase64Audio(data.audio_base64);
        } catch (e) { console.error('Voice playback error:', e); }
      }

      // Auto-restart listening after speaking (continuous call feel)
      setVoiceState('idle');
      // Small delay before auto-restarting to feel natural
      setTimeout(() => {
        if (voiceMode) startRecording();
      }, 1500);

    } catch (error) {
      console.error('Voice chat error:', error);
      setVoiceTranscript('Connection error. Tap the mic to try again.');
      setVoiceState('idle');
    }
  };

  const enterVoiceMode = () => {
    setVoiceMode(true);
    setIsVoiceMinimized(false);
    setVoiceState('idle');
    setVoiceTranscript('');
    // Start listening immediately on click so browser doesn't block the mic prompt
    startRecording();
  };

  const exitVoiceMode = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {
        console.error('Error stopping recording:', e);
      }
      recordingRef.current = null;
    }
    setVoiceMode(false);
    setIsVoiceMinimized(false);
    setVoiceState('idle');
    setVoiceTranscript('');
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
          {/* Top Bar */}
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
            <Pressable style={vs.iconBtn}>
              <UserPlus color="#fff" size={24} />
            </Pressable>
          </View>

          {/* Center — Avatar */}
          <View style={vs.center}>
            <View style={vs.avatarWrapper}>
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
            </View>

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
                <Text style={vs.transcriptText}>"{voiceTranscript}"</Text>
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
                  Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    playThroughEarpieceAndroid: speakerOn, // toggles between speaker/earpiece
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
                    setVoiceState('idle'); // Interrupt
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
    setMessages([{
      id: '1',
      text: 'Namaste! 🙏 I am Aranya, your AI farming assistant. How can I help you with your crops, weather, or market prices today?',
      isSender: false,
      hasCallAction: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  const handleReport = () => {
    setMenuVisible(false);
    alert('Thank you for reporting. Our team will look into it.');
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    try {
      await AsyncStorage.removeItem('user_session');
    } catch (e) {}
    router.replace('/sign-in');
  };

  // ═══════════════════════════════════════════════════════
  // NORMAL CHAT MODE
  // ═══════════════════════════════════════════════════════
  return (
    <SafeAreaView style={cs.safeArea}>
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
            <Pressable style={cs.phoneButton} onPress={enterVoiceMode}>
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

        {/* Chat Area */}
        <ImageBackground source={require('../../assets/images/bg.png')} style={cs.chatArea}
          imageStyle={{ resizeMode: 'repeat', width: '100%', height: '100%' }}>
          <ScrollView ref={scrollViewRef} contentContainerStyle={cs.chatContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
            <View style={cs.dateBadgeContainer}>
              <View style={cs.dateBadge}><Text style={cs.dateText}>Today</Text></View>
            </View>

            {messages.map((msg) => (
              <Animated.View key={msg.id} entering={FadeInUp.delay(50).duration(300).springify()}
                style={[cs.messageBubble, msg.isSender ? cs.sentBubble : cs.receivedBubble]}>
                
                {msg.image_base64 && (
                  <Image source={{ uri: msg.image_base64 }} style={cs.messageImage} contentFit="cover" />
                )}
                {!!msg.text && (
                  <Text style={msg.isSender ? cs.sentText : cs.receivedText}>{msg.text}</Text>
                )}
                {msg.hasCallAction && (
                  <Pressable style={cs.callActionButton} onPress={enterVoiceMode}>
                    <Phone color="#10b981" size={16} />
                    <Text style={cs.callActionText}>Start Voice Chat</Text>
                  </Pressable>
                )}
                {/* Inline audio player */}
                {msg.audio_base64 && !msg.isSender && (
                  <Pressable style={cs.audioButton} onPress={() => playAudio(msg.audio_base64!, msg.id)}>
                    {playingId === msg.id ? (
                      <Pause color="#17c690" size={14} />
                    ) : (
                      <Play color="#6b7280" size={14} />
                    )}
                    <View style={cs.audioWaveform}>
                      {[4, 8, 12, 8, 14, 6, 10, 12, 6, 8, 14, 10, 6].map((h, i) => (
                        <View key={i} style={[cs.audioBar, {
                          height: h,
                          backgroundColor: playingId === msg.id ? '#17c690' : '#9ca3af',
                        }]} />
                      ))}
                    </View>
                    <Text style={[cs.audioLabel, playingId === msg.id && { color: '#17c690' }]}>
                      {playingId === msg.id ? 'Playing' : '0:00'}
                    </Text>
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
        </ImageBackground>

        {/* Image Preview */}
        {selectedImage && (
          <View style={cs.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={cs.imagePreview} contentFit="cover" />
            <Pressable style={cs.removeImageBtn} onPress={() => setSelectedImage(null)}>
              <X color="#fff" size={14} />
            </Pressable>
          </View>
        )}

        {/* Input */}
        <View style={cs.inputArea}>
          <View style={cs.inputContainer}>
            <TextInput style={cs.textInput} placeholder="Message Aranya..." placeholderTextColor="#6b7280"
              value={inputText} onChangeText={setInputText} onSubmitEditing={handleSend} />
            <Pressable style={cs.iconButton} onPress={() => pickImage(false)}>
              <Paperclip color="#4b5563" size={20} />
            </Pressable>
            <Pressable style={cs.iconButton} onPress={() => pickImage(true)}>
              <Camera color="#4b5563" size={20} />
            </Pressable>
          </View>
          {inputText.trim().length > 0 || selectedImage ? (
            <Pressable style={cs.sendButton} onPress={handleSend}>
              <Send color="#ffffff" size={20} style={{ marginLeft: -2, marginTop: 2 }} />
            </Pressable>
          ) : (
            <Pressable style={cs.sendButton} onPress={enterVoiceMode}>
              <Mic color="#ffffff" size={24} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
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
  bgImage: { opacity: 0.05, resizeMode: 'repeat' },
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
  chatArea: { flex: 1, backgroundColor: '#e5ddd5' },
  chatContent: { padding: 16, paddingBottom: 24 },
  dateBadgeContainer: { alignItems: 'center', marginVertical: 16 },
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
});
