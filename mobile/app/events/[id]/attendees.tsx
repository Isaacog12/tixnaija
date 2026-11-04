import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  UserCheck,
  Edit2,
  X,
  Users,
} from 'lucide-react-native';

import { useAuth } from '../../../src/context/AuthContext';
import { supabase } from '../../../src/supabase/client';
import { colors } from '../../../src/theme/colors';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { EmptyState } from '../../../src/components/EmptyState';
import { LoadingState } from '../../../src/components/LoadingState';

interface AttendeeTicket {
  id: string;
  ticket_code: string;
  attendee_name: string;
  attendee_email: string | null;
  status: 'valid' | 'checked_in' | 'cancelled';
  checked_in_at: string | null;
  tier_name: string;
}

export default function EventAttendeesScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [tickets, setTickets] = useState<AttendeeTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<AttendeeTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'checked_in' | 'cancelled'>('all');

  // Reassignment Modal State
  const [selectedTicket, setSelectedTicket] = useState<AttendeeTicket | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  // Manual Check-in in progress
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const fetchAttendees = useCallback(async () => {
    if (!id) return;
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
              event_id,
              name
            )
          )
        `)
        .eq('order_items.ticket_types.event_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: AttendeeTicket[] = (data || []).map((t: any) => ({
        id: t.id,
        ticket_code: t.ticket_code,
        attendee_name: t.attendee_name || 'Anonymous Attendee',
        attendee_email: t.attendee_email,
        status: t.status,
        checked_in_at: t.checked_in_at,
        tier_name: t.order_items?.ticket_types?.name || 'General Admission',
      }));

      setTickets(formatted);
    } catch (err: any) {
      console.warn('Error fetching attendees:', err);
      Alert.alert('Load Error', 'Could not load attendee roster.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  // Filter & Search
  useEffect(() => {
    let result = tickets;
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.attendee_name.toLowerCase().includes(q) ||
          (t.attendee_email && t.attendee_email.toLowerCase().includes(q)) ||
          t.ticket_code.toLowerCase().includes(q)
      );
    }
    setFilteredTickets(result);
  }, [tickets, statusFilter, searchQuery]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAttendees();
  };

  // Manual Check In via RPC
  const handleManualCheckIn = async (ticket: AttendeeTicket) => {
    setCheckingInId(ticket.id);
    try {
      const { data, error } = await supabase.rpc('check_in_ticket', {
        p_ticket_code: ticket.ticket_code,
        p_event_id: id,
      });

      if (error) throw error;
      const res = data as any;
      if (!res.success) {
        Alert.alert('Check-In Failed', res.error || 'Could not check in ticket.');
      } else {
        Alert.alert('Success', `${ticket.attendee_name} has been checked in!`);
        await fetchAttendees();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Check-in failed');
    } finally {
      setCheckingInId(null);
    }
  };

  // Reassign Ticket Attendee
  const handleSaveReassignment = async () => {
    if (!selectedTicket || !newName.trim()) {
      Alert.alert('Validation Error', 'Attendee name is required.');
      return;
    }

    setIsReassigning(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          attendee_name: newName.trim(),
          attendee_email: newEmail.trim() || null,
        } as any)
        .eq('id', selectedTicket.id);

      if (error) throw error;

      Alert.alert('Success', 'Attendee details updated.');
      setSelectedTicket(null);
      await fetchAttendees();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update ticket attendee.');
    } finally {
      setIsReassigning(false);
    }
  };

  // Cancel Ticket
  const handleCancelTicket = (ticket: AttendeeTicket) => {
    Alert.alert(
      'Cancel Ticket',
      `Are you sure you want to cancel the ticket for ${ticket.attendee_name}? It can no longer be used for entry.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Ticket',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('tickets')
                .update({ status: 'cancelled' } as any)
                .eq('id', ticket.id);

              if (error) throw error;
              Alert.alert('Cancelled', 'Ticket marked as cancelled.');
              await fetchAttendees();
            } catch (err: any) {
              Alert.alert('Cancellation Error', err.message || 'Failed to cancel ticket.');
            }
          },
        },
      ]
    );
  };

  // Stats
  const checkedInCount = tickets.filter((t) => t.status === 'checked_in').length;
  const totalCount = tickets.length;
  const checkInPercent = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendee Roster</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress & Stat Banner */}
      <View style={styles.statBanner}>
        <View style={styles.statInfo}>
          <Text style={styles.statBigNumber}>
            {checkedInCount} <Text style={styles.statSmallNumber}>/ {totalCount}</Text>
          </Text>
          <Text style={styles.statLabel}>Checked In ({checkInPercent}%)</Text>
        </View>
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${checkInPercent}%` }]} />
          </View>
        </View>
      </View>

      {/* Search & Status Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email or ticket code..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterTabs}>
          {(['all', 'valid', 'checked_in', 'cancelled'] as const).map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setStatusFilter(tab)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {tab === 'all'
                    ? 'All'
                    : tab === 'valid'
                    ? 'Unused'
                    : tab === 'checked_in'
                    ? 'Checked In'
                    : 'Cancelled'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Attendee List */}
      {isLoading ? (
        <LoadingState message="Loading attendees..." />
      ) : filteredTickets.length === 0 ? (
        <EmptyState
          title="No Attendees Found"
          message={
            searchQuery || statusFilter !== 'all'
              ? 'No attendees match your search query.'
              : 'No tickets have been purchased yet for this event.'
          }
        />
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const isCheckedIn = item.status === 'checked_in';
            const isCancelled = item.status === 'cancelled';
            const isCheckingIn = checkingInId === item.id;

            return (
              <View style={styles.ticketCard}>
                <View style={styles.ticketMain}>
                  <View style={styles.nameRow}>
                    <Text style={styles.attendeeName} numberOfLines={1}>
                      {item.attendee_name}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        isCheckedIn && styles.badgeCheckedIn,
                        item.status === 'valid' && styles.badgeValid,
                        isCancelled && styles.badgeCancelled,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {isCheckedIn ? 'CHECKED IN' : isCancelled ? 'CANCELLED' : 'VALID'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.tierName}>{item.tier_name}</Text>
                  {item.attendee_email && (
                    <Text style={styles.emailText}>{item.attendee_email}</Text>
                  )}

                  <Text style={styles.codeText}>Code: {item.ticket_code}</Text>

                  {isCheckedIn && item.checked_in_at && (
                    <View style={styles.checkedInTimeRow}>
                      <Clock size={12} color={colors.success} />
                      <Text style={styles.checkedInTimeText}>
                        Checked in at {new Date(item.checked_in_at).toLocaleTimeString()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Quick Actions */}
                <View style={styles.actionsRow}>
                  {!isCheckedIn && !isCancelled && (
                    <TouchableOpacity
                      style={styles.checkInBtn}
                      onPress={() => handleManualCheckIn(item)}
                      disabled={isCheckingIn}
                      activeOpacity={0.7}
                    >
                      {isCheckingIn ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <UserCheck size={14} color="#fff" style={{ marginRight: 4 }} />
                          <Text style={styles.checkInBtnText}>Check In</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => {
                      setSelectedTicket(item);
                      setNewName(item.attendee_name);
                      setNewEmail(item.attendee_email || '');
                    }}
                    activeOpacity={0.7}
                  >
                    <Edit2 size={16} color={colors.text} />
                  </TouchableOpacity>

                  {!isCancelled && !isCheckedIn && (
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => handleCancelTicket(item)}
                      activeOpacity={0.7}
                    >
                      <XCircle size={16} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Ticket Reassignment Modal */}
      <Modal
        visible={Boolean(selectedTicket)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reassign Ticket</Text>
              <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Update the attendee name and email on this ticket stub.
            </Text>

            <Input
              label="Attendee Full Name *"
              value={newName}
              onChangeText={setNewName}
            />

            <Input
              label="Attendee Email"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setSelectedTicket(null)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Changes"
                variant="primary"
                loading={isReassigning}
                onPress={handleSaveReassignment}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  statBanner: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statBigNumber: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statSmallNumber: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  statLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarWrapper: {
    height: 6,
    backgroundColor: colors.surfaceHover,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarBg: {
    height: '100%',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  searchSection: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  ticketMain: {
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  attendeeName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCheckedIn: {
    backgroundColor: `${colors.success}22`,
  },
  badgeValid: {
    backgroundColor: `${colors.primary}22`,
  },
  badgeCancelled: {
    backgroundColor: `${colors.error}22`,
  },
  badgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierName: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  emailText: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  codeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  checkedInTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  checkedInTimeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 10,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  checkInBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
