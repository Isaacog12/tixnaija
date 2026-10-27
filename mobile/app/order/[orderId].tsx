import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Calendar, MapPin, Share2, ArrowLeft, CheckCircle2, Ticket } from 'lucide-react-native';
import { supabase } from '../../src/supabase/client';
import { Header } from '../../src/components/Header';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { Button } from '../../src/components/Button';
import { colors } from '../../src/theme/colors';
import { formatEventDate, formatEventTime } from '../../src/utils/date';

const { width } = Dimensions.get('window');

function TicketStub({
  ticket,
  event,
  ticketTypeName,
}: {
  ticket: any;
  event: any;
  ticketTypeName: string;
}) {
  const viewShotRef = useRef<any>(null);

  const handleShareTicket = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Share ticket for ${event.title}`,
          });
        } else {
          await Share.share({
            title: `My Ticket: ${event.title}`,
            message: `I'm attending ${event.title}! Ticket code: ${ticket.ticket_code}`,
          });
        }
      }
    } catch (err: any) {
      console.warn('Share error:', err);
    }
  };

  const statusColor =
    ticket.status === 'valid'
      ? colors.success
      : ticket.status === 'checked_in'
      ? colors.warning
      : colors.error;

  return (
    <View style={styles.stubWrapper}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
        <View style={styles.stubCard}>
          {/* Header */}
          <View style={styles.stubHeader}>
            <Text style={styles.stubEventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <View style={[styles.stubStatusBadge, { borderColor: statusColor }]}>
              <Text style={[styles.stubStatusText, { color: statusColor }]}>
                {ticket.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrContainer}>
            <View style={styles.qrWhiteBox}>
              <QRCode
                value={ticket.ticket_code}
                size={Math.min(width * 0.52, 200)}
                color="#000000"
                backgroundColor="#ffffff"
              />
            </View>
            <Text style={styles.qrCodeText}>
              Code: {ticket.ticket_code.slice(0, 8).toUpperCase()}-...
            </Text>
          </View>

          {/* Divider with punch notches */}
          <View style={styles.punchDividerRow}>
            <View style={styles.notchLeft} />
            <View style={styles.dashedLine} />
            <View style={styles.notchRight} />
          </View>

          {/* Details */}
          <View style={styles.stubDetails}>
            <View style={styles.stubFieldRow}>
              <View style={styles.stubField}>
                <Text style={styles.stubLabel}>ATTENDEE</Text>
                <Text style={styles.stubValue} numberOfLines={1}>
                  {ticket.attendee_name || 'Ticket Holder'}
                </Text>
              </View>
              <View style={styles.stubField}>
                <Text style={styles.stubLabel}>TIER</Text>
                <Text style={styles.stubValue} numberOfLines={1}>
                  {ticketTypeName}
                </Text>
              </View>
            </View>

            <View style={styles.stubFieldRow}>
              <View style={styles.stubField}>
                <Text style={styles.stubLabel}>DATE</Text>
                <Text style={styles.stubValue} numberOfLines={1}>
                  {formatEventDate(event.start_datetime)}
                </Text>
              </View>
              <View style={styles.stubField}>
                <Text style={styles.stubLabel}>VENUE</Text>
                <Text style={styles.stubValue} numberOfLines={1}>
                  {event.venue_name || 'TBA'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ViewShot>

      {/* Share Button */}
      <Button
        title="Share Ticket Image"
        variant="secondary"
        size="md"
        icon={<Share2 size={16} color={colors.text} />}
        onPress={handleShareTicket}
        style={styles.shareBtn}
      />
    </View>
  );
}

export default function OrderTicketsScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const fetchOrder = async () => {
    if (!orderId) throw new Error('Order ID is missing.');

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        *,
        events (*),
        order_items (
          id,
          quantity,
          ticket_types ( name ),
          tickets (
            id,
            ticket_code,
            attendee_name,
            attendee_email,
            status,
            checked_in_at
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderErr || !order) throw orderErr || new Error('Order not found.');

    return order;
  };

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: fetchOrder,
    enabled: Boolean(orderId),
  });

  if (isLoading) {
    return <LoadingState message="Retrieving tickets..." />;
  }

  if (isError || !order) {
    return (
      <ErrorState
        title="Tickets Unavailable"
        message={(error as any)?.message || 'Could not find the requested tickets.'}
        onRetry={refetch}
      />
    );
  }

  const event = order.events;
  const items = order.order_items || [];

  return (
    <View style={styles.root}>
      <Header
        title="Order Tickets"
        onBack={() => router.replace('/(tabs)/tickets')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Banner */}
        <View style={styles.successBanner}>
          <CheckCircle2 size={24} color={colors.success} />
          <View style={styles.successTextCol}>
            <Text style={styles.successTitle}>Tickets Confirmed!</Text>
            <Text style={styles.successSub}>
              Present your QR code at the event gate for check-in.
            </Text>
          </View>
        </View>

        {/* Tickets Stubs */}
        {items.map((item: any) => {
          const tierName = item.ticket_types?.name || 'General Admission';
          const tickets = item.tickets || [];

          return tickets.map((t: any) => (
            <TicketStub
              key={t.id}
              ticket={t}
              event={event}
              ticketTypeName={tierName}
            />
          ));
        })}

        <Button
          title="Back to My Tickets"
          variant="outline"
          size="lg"
          onPress={() => router.replace('/(tabs)/tickets')}
          style={styles.doneBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.successMuted,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.success,
  },
  successTextCol: {
    flex: 1,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  successSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stubWrapper: {
    marginBottom: 24,
  },
  stubCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stubHeader: {
    padding: 16,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stubEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 10,
  },
  stubStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  stubStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  qrWhiteBox: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  qrCodeText: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  punchDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    position: 'relative',
  },
  notchLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    marginLeft: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  notchRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    marginRight: -10,
  },
  stubDetails: {
    padding: 16,
    gap: 12,
  },
  stubFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stubField: {
    flex: 1,
  },
  stubLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stubValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  shareBtn: {
    marginTop: 10,
  },
  doneBtn: {
    marginTop: 12,
  },
});
