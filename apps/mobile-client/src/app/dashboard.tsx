import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ImageBackground, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Phone, Paperclip, Camera, Send, Check, CheckCheck, X, Mic, MicOff, Volume2, PhoneOff } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, FadeOut, FadeInDown, ZoomIn, ZoomOut } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import i18n from '../lib/i18n';

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

export default function Dashboard() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Voice Mode State
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [callDuration, setCallDuration] = useState(0);

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

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const playAudio = async (audioBase64: string, msgId: string) => {
    try {
      // Stop previous
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (playingId === msgId) {
        setPlayingId(null);
        return;
      }

      setPlayingId(msgId);
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${audioBase64}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      setPlayingId(null);
    }
  };

  const pickImage = async (useCamera = false) => {
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      };
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
    } catch (error) {
      console.error("Image pick error:", error);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const userText = overrideText?.trim() || inputText.trim();
    if (!userText && !selectedImage) return;

    const b64Img = selectedImage;
    const newMessage: Message = {
      id: Date.now().toString(),
      text: userText,
      isSender: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      image_base64: b64Img || undefined,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setSelectedImage(null);
    setIsTyping(true);
    if (voiceMode) setVoiceState('processing');

    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          user_id: 'demo_user_123',
          language: i18n.locale,
          image_base64: b64Img,
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
          await playAudio(data.audio_base64, reply.id);
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
    } finally {
      setIsTyping(false);
      if (voiceMode) setVoiceState('idle');
    }
  };

  const enterVoiceMode = () => {
    setVoiceMode(true);
    setVoiceState('idle');
  };

  const exitVoiceMode = async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setVoiceMode(false);
    setVoiceState('idle');
    setPlayingId(null);
  };

  // ═══════════════════════════════════════════════════════
  // VOICE MODE FULL-SCREEN OVERLAY
  // ═══════════════════════════════════════════════════════
  if (voiceMode) {
    return (
      <SafeAreaView style={styles.voiceOverlay}>
        {/* Gradient-like animated background */}
        <View style={styles.voiceBg}>
          {/* Top bar */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.voiceTopBar}>
            <Text style={styles.voiceTopLabel}>Voice Chat</Text>
            <Text style={styles.voiceTimer}>{formatDuration(callDuration)}</Text>
          </Animated.View>

          {/* Avatar & status */}
          <View style={styles.voiceCenter}>
            <Animated.View entering={ZoomIn.duration(500)} style={styles.voiceAvatarRing}>
              <View style={[
                styles.voiceAvatarOuter,
                voiceState === 'speaking' && styles.voiceAvatarSpeaking,
                voiceState === 'listening' && styles.voiceAvatarListening,
              ]}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.voiceAvatarImg}
                  contentFit="contain"
                />
              </View>
            </Animated.View>
            <Animated.Text entering={FadeIn.delay(300)} style={styles.voiceName}>Aranya</Animated.Text>
            <Animated.Text entering={FadeIn.delay(400)} style={styles.voiceStatus}>
              {voiceState === 'idle' && '🟢 Connected'}
              {voiceState === 'listening' && '🎤 Listening...'}
              {voiceState === 'processing' && '⏳ Thinking...'}
              {voiceState === 'speaking' && '🔊 Speaking...'}
            </Animated.Text>
          </View>

          {/* Quick text input for voice mode */}
          <View style={styles.voiceInputArea}>
            <View style={styles.voiceInputBox}>
              <TextInput
                style={styles.voiceTextInput}
                placeholder="Type or speak your question..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSend()}
              />
              <Pressable onPress={() => handleSend()} style={styles.voiceSendBtn}>
                <Send color="#fff" size={18} />
              </Pressable>
            </View>
          </View>

          {/* Bottom controls */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.voiceControls}>
            <Pressable style={styles.voiceControlBtn} onPress={() => {}}>
              <Volume2 color="#fff" size={24} />
              <Text style={styles.voiceControlLabel}>Speaker</Text>
            </Pressable>

            <Pressable style={styles.voiceEndBtn} onPress={exitVoiceMode}>
              <PhoneOff color="#fff" size={28} />
            </Pressable>

            <Pressable style={styles.voiceControlBtn} onPress={() => {}}>
              <Mic color="#fff" size={24} />
              <Text style={styles.voiceControlLabel}>Mute</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════
  // NORMAL CHAT MODE
  // ═══════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Image source={require('../../assets/images/logo.png')} style={styles.avatarImage} contentFit="contain" />
            </View>
            <View>
              <Text style={styles.headerName}>Aranya</Text>
              {isTyping ? (
                <Animated.Text entering={FadeIn} style={[styles.headerStatus, { color: '#fb923c' }]}>typing...</Animated.Text>
              ) : (
                <Animated.Text entering={FadeIn} style={styles.headerStatus}>Online</Animated.Text>
              )}
            </View>
          </View>
          <Pressable style={styles.phoneButton} onPress={enterVoiceMode}>
            <Phone color="#000" size={24} />
          </Pressable>
        </View>

        {/* Chat Area */}
        <ImageBackground
          source={require('../../assets/images/bg.png')}
          style={styles.chatArea}
          imageStyle={{ resizeMode: 'repeat', width: '100%', height: '100%' }}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            <View style={styles.dateBadgeContainer}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>Today</Text>
              </View>
            </View>

            {messages.map((msg) => (
              <Animated.View
                key={msg.id}
                entering={FadeInUp.delay(50).duration(300).springify()}
                style={[styles.messageBubble, msg.isSender ? styles.sentBubble : styles.receivedBubble]}
              >
                {msg.image_base64 && (
                  <Image source={{ uri: msg.image_base64 }} style={styles.messageImage} contentFit="cover" />
                )}

                {!!msg.text && (
                  <Text style={msg.isSender ? styles.sentText : styles.receivedText}>{msg.text}</Text>
                )}

                {msg.hasCallAction && (
                  <Pressable style={styles.callActionButton} onPress={enterVoiceMode}>
                    <Phone color="#10b981" size={16} />
                    <Text style={styles.callActionText}>Start Voice Chat</Text>
                  </Pressable>
                )}

                {/* Audio play button for AI messages */}
                {msg.audio_base64 && !msg.isSender && (
                  <Pressable
                    style={styles.audioButton}
                    onPress={() => playAudio(msg.audio_base64!, msg.id)}
                  >
                    <Volume2 color={playingId === msg.id ? '#17c690' : '#6b7280'} size={16} />
                    <Text style={[styles.audioLabel, playingId === msg.id && { color: '#17c690' }]}>
                      {playingId === msg.id ? 'Playing...' : 'Play Audio'}
                    </Text>
                  </Pressable>
                )}

                <View style={styles.messageFooter}>
                  <Text style={msg.isSender ? styles.sentTime : styles.receivedTime}>
                    {msg.timestamp || ''}
                  </Text>
                  {msg.isSender && msg.status === 'sent' && (
                    <Check color="#ffedd5" size={14} style={styles.tickIcon} />
                  )}
                  {msg.isSender && msg.status === 'read' && (
                    <CheckCheck color="#34B7F1" size={15} style={styles.tickIcon} />
                  )}
                </View>
              </Animated.View>
            ))}

            {isTyping && (
              <Animated.View entering={FadeIn} style={[styles.messageBubble, styles.receivedBubble, { paddingVertical: 16 }]}>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </ImageBackground>

        {/* Image Preview */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} contentFit="cover" />
            <Pressable style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
              <X color="#fff" size={14} />
            </Pressable>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Message Aranya..."
              placeholderTextColor="#6b7280"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSend()}
            />
            <Pressable style={styles.iconButton} onPress={() => pickImage(false)}>
              <Paperclip color="#4b5563" size={20} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => pickImage(true)}>
              <Camera color="#4b5563" size={20} />
            </Pressable>
          </View>
          <Pressable style={styles.sendButton} onPress={() => handleSend()}>
            <Send color="#ffffff" size={20} style={styles.sendIcon} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Chat Mode ──
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  headerName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  headerStatus: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#17c690' },
  phoneButton: { padding: 8, marginRight: -8 },
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
  audioButton: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8,
    backgroundColor: '#f3f4f6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
  },
  audioLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#6b7280', marginLeft: 6 },
  // Typing animation
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9ca3af' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.8 },
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
  sendIcon: { marginLeft: -2, marginTop: 2 },

  // ── Voice Mode ──
  voiceOverlay: { flex: 1, backgroundColor: '#0f172a' },
  voiceBg: { flex: 1, justifyContent: 'space-between' },
  voiceTopBar: {
    alignItems: 'center', paddingTop: 24, paddingBottom: 16,
  },
  voiceTopLabel: {
    fontSize: 14, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase', letterSpacing: 2,
  },
  voiceTimer: {
    fontSize: 32, fontFamily: 'Inter_300Light', color: '#ffffff', marginTop: 4,
  },
  voiceCenter: { alignItems: 'center', justifyContent: 'center' },
  voiceAvatarRing: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 3, borderColor: 'rgba(23,198,144,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceAvatarOuter: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.1)',
  },
  voiceAvatarSpeaking: {
    borderColor: '#17c690', borderWidth: 4,
    shadowColor: '#17c690', shadowOpacity: 0.5, shadowRadius: 20,
  },
  voiceAvatarListening: {
    borderColor: '#fb923c', borderWidth: 4,
    shadowColor: '#fb923c', shadowOpacity: 0.5, shadowRadius: 20,
  },
  voiceAvatarImg: { width: 80, height: 80 },
  voiceName: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#ffffff', marginTop: 20 },
  voiceStatus: { fontSize: 15, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  voiceInputArea: { paddingHorizontal: 24, marginBottom: 8 },
  voiceInputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24,
    paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  voiceTextInput: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#ffffff',
    // @ts-ignore
    outlineStyle: 'none',
  },
  voiceSendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#17c690',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    paddingBottom: 48, paddingTop: 16,
  },
  voiceControlBtn: { alignItems: 'center', gap: 6 },
  voiceControlLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.6)' },
  voiceEndBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 12,
  },
});
