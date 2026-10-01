import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';

export default function BroadcastMessageScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
  const { eventId, eventTitle } = route.params || {};

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Validation Error', 'Please enter both a subject and a message.');
      return;
    }

    Alert.alert(
      'Confirm Broadcast',
      'This message will be emailed to EVERY attendee who has a paid ticket for this event. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send to All', 
          style: 'destructive',
          onPress: executeSend
        }
      ]
    );
  };

  const executeSend = async () => {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Insert into event_broadcasts
      const { data: broadcast, error: insertError } = await supabase
        .from('event_broadcasts' as any)
        .insert({
          event_id: eventId,
          organizer_id: user.id,
          subject: subject.trim(),
          message: message.trim()
        } as any)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 2. Trigger the edge function
      const { data, error: functionError } = await supabase.functions.invoke('send-event-broadcast', {
        body: { broadcastId: (broadcast as any).id }
      });

      if (functionError) throw functionError;
      if (data?.error) throw new Error(data.error);

      Alert.alert('Success', `Message successfully sent to ${data?.count || 0} attendees!`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 40) }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Broadcast Message</Text>
        <Text style={styles.subtitle}>
          Send an email update to all attendees of <Text style={{ color: '#f4f2f0', fontWeight: 'bold' }}>{eventTitle || 'this event'}</Text>.
        </Text>

        <Text style={styles.label}>Subject</Text>
        <TextInput 
          style={styles.input} 
          value={subject} 
          onChangeText={setSubject} 
          placeholder="e.g. Venue Change Notice" 
          placeholderTextColor="#8e8b85" 
        />

        <Text style={styles.label}>Message</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          value={message} 
          onChangeText={setMessage} 
          multiline 
          placeholder="Type your message here..." 
          placeholderTextColor="#8e8b85" 
        />

        <TouchableOpacity 
          style={[styles.button, (!subject.trim() || !message.trim()) && { opacity: 0.5 }]} 
          onPress={handleSend} 
          disabled={sending || !subject.trim() || !message.trim()}
        >
          {sending ? (
            <ActivityIndicator color="#22201e" />
          ) : (
            <>
              <Send color="#22201e" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Send to All Attendees</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
  },
  content: {
    padding: 20,
    paddingTop: 100,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f4f2f0',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#c2bdb8',
    marginBottom: 24,
    lineHeight: 22,
  },
  label: {
    color: '#a39e99',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1a1917',
    color: '#f4f2f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  textArea: {
    height: 180,
    textAlignVertical: 'top',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#f2611e',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#22201e',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
