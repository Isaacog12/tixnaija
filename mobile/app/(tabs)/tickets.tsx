import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Ticket,
  Search,
  Calendar,
  MapPin,
  QrCode,
  KeyRound,
  Mail,
  X,
  ExternalLink,
} from 'lucide-react-native';
import { supabase } from '../../src/supabase/client';
import { useAuth } from '../../src/context/AuthContext';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { colors } from '../../src/theme/colors';
import { formatEventDate, formatEventTime } from '../../src/utils/date';

const CACHE_KEY = '@my_tickets_cache';

interface ExtractedTicket {
  id: string;
  ticket_code: string;
  status: string;
  attendee_name: string | null;
  tierName: string;
  orderId: string;
  event: any;
}

export default function TicketsTabScreen() {
  const router = useRouter();
  const { user, isOrganizer } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'checked_in'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Guest lookup modal states
  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAccessCode, setGuestAccessCode] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);

  // Fetch tickets for authenticated user
  const fetchMyTickets = async () => {
    if (!user) {
      // If offline, check cache
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          events (
            id,
            title,
            slug,
            start_datetime,
            venue_name,
            city,
            cover_image_url
          ),
          order_items (
            ticket_types ( name ),
            tickets (
              id,
              ticket_code,
              attendee_name,
              status
            )
          )
        `)
        .or(`user_id.eq.${user.id},buyer_email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ticketsList: ExtractedTicket[] = [];
      data?.forEach((order: any) => {
        const event = order.events;
        order.order_items?.forEach((item: any) => {
          const tierName = item.ticket_types?.name || 'General Admission';
          item.tickets?.forEach((ticket: any) => {
            ticketsList.push({
              ...ticket,
              tierName,
              orderId: order.id,
              event,
            });
          });
        });
      });

      // Cache for offline access
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(ticketsList));
      return ticketsList;
    } catch (err) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
      throw err;
    }
  };

  const {
    data: tickets = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['my-tickets', user?.id],
    queryFn: fetchMyTickets,
  });

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t: ExtractedTicket) => {
      const matchesFilter = filterStatus === 'all' || t.status === filterStatus;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.event?.title?.toLowerCase().includes(q) ||
        t.tierName?.toLowerCase().includes(q) ||
        t.ticket_code?.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [tickets, filterStatus, searchQuery]);

  // Guest order lookup
  const handleGuestLookup = async () => {
    if (!guestEmail.trim() || !guestAccessCode.trim()) {
      Alert.alert('Required Fields', 'Please enter both your email address and ticket access code.');
      return;
    }

    setGuestLoading(true);
    try {
      // Find matching order via RPC get_guest_order_full
      // Note: We need the orderId. In TixNaija, accessCode or payment reference unlocks the order.
      // Search by email and access code in orders:
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('id, access_code, payment_reference')
        .eq('buyer_email', guestEmail.trim().toLowerCase())
        .or(
          `access_code.eq.${guestAccessCode.trim().toUpperCase()},payment_reference.eq.${guestAccessCode.trim()}`
        )
        .maybeSingle();

      if (orderErr || !orderData) {
        throw new Error('No order found matching this email and access code.');
      }

      setGuestModalVisible(false);
      setGuestEmail('');
      setGuestAccessCode('');

      router.push({
        pathname: '/order/[orderId]' as any,
        params: { orderId: orderData.id },
      });
    } catch (err: any) {
      Alert.alert('Lookup Failed', err.message || 'Could not locate guest tickets.');
    } finally {
      setGuestLoading(false);
    }
  };

  const renderTicketCard = ({ item }: { item: ExtractedTicket }) => {
    const isCheckedIn = item.status === 'checked_in';
    const isCancelled = item.status === 'cancelled';
    const statusColor = isCheckedIn
      ? colors.warning
      : isCancelled
      ? colors.error
      : colors.success;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.ticketCard}
        onPress={() =>
          router.push({
            pathname: '/order/[orderId]' as any,
            params: { orderId: item.orderId },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.event?.title || 'Event'}
          </Text>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <Calendar size={14} color={colors.primary} />
            <Text style={styles.metaText}>
              {formatEventDate(item.event?.start_datetime)} •{' '}
              {formatEventTime(item.event?.start_datetime)}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <MapPin size={14} color={colors.textMuted} />
            <Text style={styles.metaTextMuted}>
              {item.event?.venue_name || 'Venue TBA'}
              {item.event?.city ? `, ${item.event.city}` : ''}
            </Text>
          </View>

          <View style={styles.ticketFooter}>
            <View>
              <Text style={styles.tierName}>{item.tierName}</Text>
              <Text style={styles.attendeeName}>
                {item.attendee_name || user?.user_metadata?.full_name || 'Guest'}
              </Text>
            </View>

            <View style={styles.qrIconBtn}>
              <QrCode size={18} color={colors.primary} />
              <Text style={styles.qrIconText}>View QR</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!user && tickets.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.guestContainer}>
          <Ticket size={48} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.guestTitle}>Your Tickets</Text>
          <Text style={styles.guestSub}>
            Sign in to view your tickets anytime, or locate a previous guest purchase using your email and access code.
          </Text>
          <Button
            title="Sign In to Account"
            variant="primary"
            size="lg"
            onPress={() => router.push('/(auth)/login')}
            style={styles.guestBtn}
          />
          <Button
            title="Find Guest Order"
            variant="outline"
            size="lg"
            onPress={() => setGuestModalVisible(true)}
            style={styles.guestBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>My Tickets</Text>
          <TouchableOpacity
            style={styles.guestLookupTrigger}
            onPress={() => setGuestModalVisible(true)}
            accessibilityRole="button"
          >
            <KeyRound size={15} color={colors.primary} />
            <Text style={styles.guestLookupTriggerText}>Find Guest Order</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Search tickets or events..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === 'all' && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'valid' && styles.filterChipActive]}
            onPress={() => setFilterStatus('valid')}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === 'valid' && styles.filterChipTextActive,
              ]}
            >
              Valid
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filterStatus === 'checked_in' && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus('checked_in')}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === 'checked_in' && styles.filterChipTextActive,
              ]}
            >
              Used / Scanned
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tickets List */}
      <FlatList
        data={filteredTickets}
        keyExtractor={(item) => item.id}
        renderItem={renderTicketCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Ticket size={40} color={colors.textMuted} />}
            title="No tickets found"
            description={
              searchQuery
                ? `No tickets match "${searchQuery}".`
                : "You haven't claimed or purchased any tickets yet."
            }
            actionTitle="Discover Events"
            onAction={() => router.push('/(tabs)')}
          />
        }
      />

      {/* Guest Order Lookup Modal */}
      <Modal visible={guestModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find Guest Order</Text>
              <TouchableOpacity
                onPress={() => setGuestModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Enter the email address and access code from your confirmation email to unlock your tickets.
            </Text>

            <Input
              label="Email Address"
              placeholder="e.g. buyer@example.com"
              value={guestEmail}
              onChangeText={setGuestEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Mail size={18} color={colors.textMuted} />}
            />

            <Input
              label="Access Code or Payment Reference"
              placeholder="e.g. TIX-ABCD or PAY-12345"
              value={guestAccessCode}
              onChangeText={setGuestAccessCode}
              autoCapitalize="characters"
              leftIcon={<KeyRound size={18} color={colors.textMuted} />}
            />

            <Button
              title="Unlock Tickets"
              variant="primary"
              size="lg"
              loading={guestLoading}
              onPress={handleGuestLookup}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  guestLookupTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  guestLookupTriggerText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    marginLeft: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardBody: {
    padding: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  metaTextMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tierName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  attendeeName: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  qrIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  qrIconText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  guestSub: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  guestBtn: {
    width: '100%',
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSub: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
});
