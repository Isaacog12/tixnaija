import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Radio,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Mail,
  AlertCircle,
} from 'lucide-react-native';

import { useAuth } from '../../../src/context/AuthContext';
import { supabase } from '../../../src/supabase/client';
import { colors } from '../../../src/theme/colors';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { LoadingState } from '../../../src/components/LoadingState';

interface BroadcastRecord {
  id: string;
  subject: string;
  message: string;
  recipient_count: number | null;
  created_at: string;
}

export default function EventBroadcastScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [eventTitle, setEventTitle] = useState('');
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      // 1. Fetch event title
      const { data: eventData } = await supabase
        .from('events')
        .select('title')
        .eq('id', id)
        .single();

      if (eventData) {
        setEventTitle(eventData.title);
      }

      // 2. Fetch attendee count (confirmed paid orders)
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id)
        .eq('status', 'paid');

      setAttendeeCount(ordersCount || 0);

      // 3. Fetch past broadcasts
      const { data: pastBroadcasts, error: bErr } = await supabase
        .from('event_broadcasts')
        .select('*')
        .eq('event_id', id)
        .order('created_at', { ascending: false });

      if (!bErr && pastBroadcasts) {
        setBroadcasts(pastBroadcasts);
      }
    } catch (err: any) {
      console.warn('Error loading broadcast data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Send Broadcast to Attendees
  const handleSendBroadcast = async () => {
    if (!user || !id) return;
    if (!subject.trim()) {
      Alert.alert('Validation Error', 'Please provide a subject line for the broadcast email.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Validation Error', 'Please provide a message body for the announcement.');
      return;
    }
    if (attendeeCount === 0) {
      Alert.alert(
        'No Attendees',
        'This event does not have any confirmed ticket holders yet to receive an announcement.'
      );
      return;
    }

    Alert.alert(
      'Confirm Broadcast',
      `Send this broadcast to all ~${attendeeCount} confirmed ticket holders?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Announcement',
          onPress: async () => {
            setIsSending(true);
            setStatusMessage('');
            try {
              // 1. Insert row into event_broadcasts
              const { data: broadcastRow, error: insertError } = await supabase
                .from('event_broadcasts')
                .insert({
                  event_id: id,
                  organizer_id: user.id,
                  subject: subject.trim(),
                  message: message.trim(),
                } as any)
                .select()
                .single();

              if (insertError) throw insertError;

              // 2. Call send-event-broadcast Edge Function
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                throw new Error('Active session required to deliver broadcast.');
              }

              const edgeRes = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-event-broadcast`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ broadcastId: broadcastRow.id }),
                }
              );

              const responseData = await edgeRes.json();
              if (!edgeRes.ok) {
                throw new Error(responseData.error || 'Broadcast delivery failed.');
              }

              Alert.alert(
                'Broadcast Sent!',
                `Delivered successfully to ${responseData.count || 0} attendees.`
              );

              setSubject('');
              setMessage('');
              await loadData();
            } catch (err: any) {
              Alert.alert('Delivery Error', err.message || 'Failed to dispatch broadcast.');
            } finally {
              setIsSending(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return <LoadingState message="Loading broadcast dashboard..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Broadcast</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Audience Banner */}
        <View style={styles.audienceCard}>
          <View style={styles.audienceIconBox}>
            <Users size={20} color={colors.primary} />
          </View>
          <View style={styles.audienceInfo}>
            <Text style={styles.audienceTitle}>
              {attendeeCount} Confirmed Attendees
            </Text>
            <Text style={styles.audienceSubtitle} numberOfLines={1}>
              {eventTitle || 'Your Event'}
            </Text>
          </View>
        </View>

        {/* Compose Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Compose Announcement</Text>
          <Text style={styles.cardHelper}>
            This announcement will be emailed immediately to all ticket holders who have opted in
            to event updates.
          </Text>

          <Input
            label="Subject Line *"
            placeholder="e.g. Venue Change Notice / Parking Information"
            value={subject}
            onChangeText={setSubject}
          />

          <Input
            label="Message Content *"
            placeholder="Write your update to attendees here..."
            multiline
            numberOfLines={6}
            value={message}
            onChangeText={setMessage}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />

          <Button
            title="Dispatch Broadcast"
            variant="primary"
            loading={isSending}
            onPress={handleSendBroadcast}
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Previous Broadcasts Section */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Previous Announcements</Text>

          {broadcasts.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Mail size={32} color={colors.textMuted} style={{ marginBottom: 6 }} />
              <Text style={styles.emptyHistoryTitle}>No Broadcasts Sent Yet</Text>
              <Text style={styles.emptyHistorySub}>
                Updates and notices sent to your attendees will appear here.
              </Text>
            </View>
          ) : (
            broadcasts.map((b) => (
              <View key={b.id} style={styles.historyCard}>
                <View style={styles.historyTopRow}>
                  <Text style={styles.historySubject} numberOfLines={1}>
                    {b.subject}
                  </Text>
                  <View style={styles.deliveredBadge}>
                    <CheckCircle2 size={12} color={colors.success} style={{ marginRight: 3 }} />
                    <Text style={styles.deliveredBadgeText}>
                      {b.recipient_count !== null ? `${b.recipient_count} sent` : 'Sent'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.historyMessage} numberOfLines={3}>
                  {b.message}
                </Text>

                <View style={styles.historyDateRow}>
                  <Clock size={11} color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.historyDate}>
                    {new Date(b.created_at).toLocaleString('en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  audienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  audienceIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${colors.primary}22`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audienceInfo: {
    flex: 1,
  },
  audienceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  audienceSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  cardHeader: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardHelper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  historySection: {
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  emptyHistory: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyHistoryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyHistorySub: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historySubject: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.success}18`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deliveredBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  historyMessage: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDate: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
