import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Share2,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
} from 'lucide-react-native';

import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Button } from '../../src/components/Button';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';

export default function TicketDetailScreen() {
  const router = useRouter();
  const { ticketCode } = useLocalSearchParams<{ ticketCode: string }>();

  const [ticket, setTicket] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [tier, setTier] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    if (!ticketCode) return;

    const loadTicket = async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select(`
            id,
            ticket_code,
            attendee_name,
            attendee_email,
            status,
            checked_in_at,
            order_items!inner(
              ticket_types!inner(
                id,
                name,
                price_kobo,
                events!inner(
                  id,
                  title,
                  slug,
                  venue_name,
                  city,
                  state,
                  start_datetime,
                  end_datetime,
                  cover_image_url
                )
              )
            )
          `)
          .eq('ticket_code', ticketCode)
          .single();

        if (error) throw error;

        setTicket(data);
        const orderItem = (data as any).order_items;
        const ticketType = orderItem?.ticket_types;
        setTier(ticketType);
        setEvent(ticketType?.events);
      } catch (err: any) {
        console.warn('Load ticket error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTicket();
  }, [ticketCode]);

  const handleShareStory = async () => {
    if (!viewShotRef.current?.capture) return;
    setIsSharing(true);
    try {
      const uri = await viewShotRef.current.capture();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your TixNaija Ticket',
        });
      } else {
        await Share.share({
          message: `I have a ticket for ${event?.title}! Code: ${ticket?.ticket_code}`,
        });
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Could not export ticket.');
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading ticket details..." />;
  }

  if (!ticket || !event) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ticket Pass</Text>
          <View style={{ width: 36 }} />
        </View>
        <EmptyState
          title="Ticket Not Found"
          message="We could not find a ticket matching this code. Please check your order confirmation."
        />
      </SafeAreaView>
    );
  }

  const isCheckedIn = ticket.status === 'checked_in';
  const isCancelled = ticket.status === 'cancelled';
  const isValid = ticket.status === 'valid';

  const dateStr = new Date(event.start_datetime).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = new Date(event.start_datetime).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Official Ticket Stub</Text>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShareStory}
          disabled={isSharing}
        >
          {isSharing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Share2 size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 0.95 }}
          style={styles.stubWrapper}
        >
          {/* Top flyer banner */}
          {event.cover_image_url && (
            <Image source={{ uri: event.cover_image_url }} style={styles.eventImage} />
          )}

          {/* Event details */}
          <View style={styles.stubHeader}>
            <View style={styles.statusBadgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  isValid && styles.statusValid,
                  isCheckedIn && styles.statusCheckedIn,
                  isCancelled && styles.statusCancelled,
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {isCheckedIn ? 'CHECKED IN' : isCancelled ? 'CANCELLED' : 'VALID ENTRY'}
                </Text>
              </View>
              <Text style={styles.tierPill}>{tier?.name || 'General'}</Text>
            </View>

            <Text style={styles.eventTitle}>{event.title}</Text>

            <View style={styles.metaRow}>
              <Calendar size={13} color={colors.primary} />
              <Text style={styles.metaText}>{dateStr}</Text>
              <Clock size={13} color={colors.primary} style={{ marginLeft: 8 }} />
              <Text style={styles.metaText}>{timeStr}</Text>
            </View>

            {event.venue_name && (
              <View style={styles.metaRow}>
                <MapPin size={13} color={colors.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {event.venue_name}
                  {event.city ? `, ${event.city}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Perforated separator */}
          <View style={styles.perforationRow}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashLine} />
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          {/* QR Code and Attendee */}
          <View style={styles.stubBody}>
            <View style={styles.qrContainer}>
              <QRCode
                value={ticket.ticket_code}
                size={180}
                color="#000"
                backgroundColor="#fff"
              />
            </View>

            <Text style={styles.codeText}>{ticket.ticket_code}</Text>
            <Text style={styles.attendeeName}>
              Attendee: {ticket.attendee_name || 'Holder'}
            </Text>

            {isCheckedIn && ticket.checked_in_at && (
              <View style={styles.checkInNote}>
                <CheckCircle2 size={14} color={colors.success} style={{ marginRight: 4 }} />
                <Text style={styles.checkInNoteText}>
                  Admitted at {new Date(ticket.checked_in_at).toLocaleTimeString()}
                </Text>
              </View>
            )}
          </View>
        </ViewShot>

        {/* Action Button */}
        <Button
          title="Share / Save Pass"
          variant="outline"
          onPress={handleShareStory}
          loading={isSharing}
          style={{ marginTop: 20 }}
        />
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
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  stubWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  stubHeader: {
    padding: 20,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusValid: {
    backgroundColor: `${colors.success}22`,
  },
  statusCheckedIn: {
    backgroundColor: `${colors.primary}22`,
  },
  statusCancelled: {
    backgroundColor: `${colors.error}22`,
  },
  statusBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierPill: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  eventTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    position: 'relative',
  },
  notch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    position: 'absolute',
    top: 0,
  },
  notchLeft: {
    left: -12,
  },
  notchRight: {
    right: -12,
  },
  dashLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },
  stubBody: {
    padding: 24,
    alignItems: 'center',
  },
  qrContainer: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 14,
  },
  codeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  attendeeName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  checkInNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.success}18`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  checkInNoteText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
});
