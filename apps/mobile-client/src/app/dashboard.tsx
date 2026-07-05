import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Phone, Paperclip, Camera, Send, Check, CheckCheck, X } from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn, FadeOutUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import i18n from '../lib/i18n';

type Message = {
  id: string;
  text: string;
  isSender: boolean;
  hasCallAction?: boolean;
  timestamp?: string;
  status?: 'sent' | 'delivered' | 'read';
  image_base64?: string;
};

export default function Dashboard() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Call State
  const [isCallActive, setIsCallActive] = useState(false);
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
        if (status !== 'granted') {
          alert('Sorry, we need camera permissions to make this work!');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error("Image pick error:", error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;
    
    const userText = inputText.trim();
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
    
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          user_id: 'demo_user_123',
          language: i18n.locale,
          image_base64: b64Img
        }),
      });
      
      const data = await response.json();
      
      // Update all sent messages to 'read' since the AI has replied
      setMessages(prev => prev.map(m => m.isSender ? { ...m, status: 'read' } : m));
      
      if (data.reply) {
        const reply: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          isSender: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, reply]);
      }
    } catch (error) {
      console.error('Chat API Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I am having trouble connecting to the server right now. Please try again later.',
        isSender: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleJoinCall = async () => {
    setIsCallActive(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aranya-ai-6r0j.onrender.com';
      await fetch(`${apiUrl}/test-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: "+1234567890", 
          message: "Namaste! Connecting you to Aranya Voice..."
        }),
      });
    } catch (error) {
      console.error('Voice Call Error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.avatarImage} 
                contentFit="contain" 
              />
            </View>
            <View>
              <Text style={styles.headerName}>Aranya</Text>
              {isTyping ? (
                <Animated.Text entering={FadeIn} style={[styles.headerStatus, { color: '#fb923c' }]}>
                  typing...
                </Animated.Text>
              ) : (
                <Animated.Text entering={FadeIn} style={styles.headerStatus}>
                  Online
                </Animated.Text>
              )}
            </View>
          </View>
          <Pressable style={styles.phoneButton} onPress={handleJoinCall}>
            <Phone color="#000" size={24} />
          </Pressable>
        </View>

        {/* Active Call Banner */}
        {isCallActive && (
          <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.activeCallBanner}>
            <View style={styles.callBannerLeft}>
              <View style={styles.pulsingDot} />
              <Text style={styles.callBannerText}>Tap to return to call</Text>
              <Text style={styles.callBannerTime}>{formatDuration(callDuration)}</Text>
            </View>
            <Pressable style={styles.endCallButton} onPress={() => setIsCallActive(false)}>
              <Phone color="#fff" size={14} style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </Animated.View>
        )}

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
            {/* Date Badge */}
            <View style={styles.dateBadgeContainer}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>Today</Text>
              </View>
            </View>

            {messages.map((msg, index) => (
              <Animated.View 
                key={msg.id} 
                entering={FadeInUp.delay(50).duration(300).springify()} 
                style={[
                  styles.messageBubble, 
                  msg.isSender ? styles.sentBubble : styles.receivedBubble
                ]}
              >
                {msg.image_base64 && (
                  <Image source={{ uri: msg.image_base64 }} style={styles.messageImage} contentFit="cover" />
                )}

                {!!msg.text && (
                  <Text style={msg.isSender ? styles.sentText : styles.receivedText}>
                    {msg.text}
                  </Text>
                )}
                
                {msg.hasCallAction && !isCallActive && (
                  <Pressable style={styles.callActionButton} onPress={handleJoinCall}>
                    <Phone color="#10b981" size={16} />
                    <Text style={styles.callActionText}>Join Voice Call</Text>
                  </Pressable>
                )}

                <View style={styles.messageFooter}>
                  <Text style={msg.isSender ? styles.sentTime : styles.receivedTime}>
                    {msg.timestamp || '10:00 AM'}
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
          </ScrollView>
        </ImageBackground>

        {/* Selected Image Preview before sending */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} contentFit="cover" />
            <Pressable style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
              <X color="#fff" size={16} />
            </Pressable>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Message Aranya..."
              placeholderTextColor="#6b7280"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
            />
            <Pressable style={styles.iconButton} onPress={() => pickImage(false)}>
              <Paperclip color="#4b5563" size={20} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => pickImage(true)}>
              <Camera color="#4b5563" size={20} />
            </Pressable>
          </View>
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Send color="#ffffff" size={20} style={styles.sendIcon} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  headerStatus: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#17c690',
  },
  phoneButton: {
    padding: 8,
    marginRight: -8,
  },
  activeCallBanner: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 9,
  },
  callBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  callBannerText: {
    color: '#ffffff',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginRight: 8,
  },
  callBannerTime: {
    color: '#ffffff',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  endCallButton: {
    backgroundColor: '#ef4444',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#e5ddd5',
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  dateBadgeContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  receivedBubble: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
  },
  receivedText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#374151',
    lineHeight: 22,
  },
  sentBubble: {
    backgroundColor: '#fc865a',
    alignSelf: 'flex-end',
    borderTopRightRadius: 4,
  },
  sentText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#ffffff',
    lineHeight: 22,
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  sentTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  receivedTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#9ca3af',
  },
  tickIcon: {
    marginLeft: 4,
  },
  callActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  callActionText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#10b981',
    marginLeft: 8,
  },
  imagePreviewContainer: {
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    left: 68,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 16,
    minHeight: 48,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#111827',
    paddingVertical: 12,
    // @ts-ignore
    outlineStyle: 'none',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#17c690',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#17c690',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  sendIcon: {
    marginLeft: -2,
    marginTop: 2,
  }
});
