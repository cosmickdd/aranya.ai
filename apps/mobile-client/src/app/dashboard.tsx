import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Phone, Paperclip, Camera, Send } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

type Message = {
  id: string;
  text: string;
  isSender: boolean;
  hasCallAction?: boolean;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Namaste! 🙏 I am Aranya, your AI farming assistant. How can I help you with your crops, weather, or market prices today?',
    isSender: false,
    hasCallAction: true,
  }
];

export default function Dashboard() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const userText = inputText.trim();
    const newMessage: Message = {
      id: Date.now().toString(),
      text: userText,
      isSender: true,
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setIsTyping(true);
    
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          user_id: 'demo_user_123'
        }),
      });
      
      const data = await response.json();
      
      if (data.reply) {
        const reply: Message = {
          id: (Date.now() + 1).toString(),
          text: data.reply,
          isSender: false,
        };
        setMessages(prev => [...prev, reply]);
      }
    } catch (error) {
      console.error('Chat API Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I am having trouble connecting to the server right now. Please try again later.',
        isSender: false,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleJoinCall = async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
      // Pass a dummy phone number for the prototype call test
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
      alert('Call initiated! (Check backend logs for Twilio status)');
    } catch (error) {
      console.error('Voice Call Error:', error);
      alert('Failed to initiate voice call.');
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
            {/* Back button removed per user request */}
            <View style={styles.avatar}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.avatarImage} 
                contentFit="contain" 
              />
            </View>
            <View>
              <Text style={styles.headerName}>Aranya</Text>
              <Text style={styles.headerStatus}>Online</Text>
            </View>
          </View>
          <Pressable style={styles.phoneButton}>
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
                <Text style={msg.isSender ? styles.sentText : styles.receivedText}>
                  {msg.text}
                </Text>
                
                {msg.hasCallAction && (
                  <Pressable style={styles.callActionButton} onPress={handleJoinCall}>
                    <Phone color="#10b981" size={16} />
                    <Text style={styles.callActionText}>Join Voice Call</Text>
                  </Pressable>
                )}
              </Animated.View>
            ))}
          </ScrollView>
        </ImageBackground>

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
            <Pressable style={styles.iconButton}>
              <Paperclip color="#4b5563" size={20} />
            </Pressable>
            <Pressable style={styles.iconButton}>
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
  chatArea: {
    flex: 1,
    backgroundColor: '#e5ddd5', // fallback background color if image fails
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
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24, // Extra padding for bottom safe area
    backgroundColor: 'transparent',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    minHeight: 48,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
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
