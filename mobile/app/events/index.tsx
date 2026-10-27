import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Plus,
  Calendar,
  Users,
  TrendingUp,
  Search,
  ChevronRight,
  Radio,
  BarChart2,
  Edit,
  ArrowLeft,
  Clock,
  MapPin,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingState } from '../../src/components/LoadingState';

interface OrganizerEvent {
  id: string;
  slug: string;
  title: string;
  cover_image_url: string | null;
  start_datetime: string;
  venue_name: string | null;
  city: string | null;
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  total_tickets: number;
  tickets_sold: number;
  gross_kobo: number;
}

export default function OrganizerDashboardScreen() {
  const router = useRouter();
  const { user, isOrganizer, isAdmin } = useAuth();

  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'cancelled'>('all');

  // Metrics
  const [totalGrossKobo, setTotalGrossKobo] = useState(0);
  const [totalTicketsSold, setTotalTicketsSold] = useState(0);

  const fetchOrganizerEvents = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('events')
        .select(`
          id,
          slug,
          title,
          cover_image_url,
          start_datetime,
          venue_name,
          city,
          status,
          ticket_types (id, capacity, remaining, price_kobo)
        `)
        .order('start_datetime', { ascending: false });

      if (!isAdmin) {
        query = query.eq('organizer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let aggGross = 0;
      let aggSold = 0;

      const formatted: OrganizerEvent[] = (data || []).map((e: any) => {
        let eventCapacity = 0;
        let eventSold = 0;
        let eventGross = 0;

        (e.ticket_types || []).forEach((tt: any) => {
          const cap = tt.capacity || 0;
          const rem = tt.remaining !== null && tt.remaining !== undefined ? tt.remaining : cap;
          const sold = Math.max(0, cap - rem);
          const price = tt.price_kobo || 0;

          eventCapacity += cap;
          eventSold += sold;
          eventGross += sold * price;
        });

        aggGross += eventGross;
        aggSold += eventSold;

        return {
          id: e.id,
          slug: e.slug,
          title: e.title,
          cover_image_url: e.cover_image_url,
          start_datetime: e.start_datetime,
          venue_name: e.venue_name,
          city: e.city,
          status: e.status,
          total_tickets: eventCapacity,
          tickets_sold: eventSold,
          gross_kobo: eventGross,
        };
      });

      setEvents(formatted);
      setTotalGrossKobo(aggGross);
      setTotalTicketsSold(aggSold);
    } catch (err) {
      console.warn('Failed to load organizer events:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchOrganizerEvents();
  }, [fetchOrganizerEvents]);

  // Filter & Search
  useEffect(() => {
    let result = events;
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.venue_name && e.venue_name.toLowerCase().includes(q))
      );
    }
    setFilteredEvents(result);
  }, [events, statusFilter, searchQuery]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrganizerEvents();
  };

  const formatNaira = (kobo: number) => {
    const naira = Math.floor(kobo / 100);
    return `₦${naira.toLocaleString()}`;
  };

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
        <Text style={styles.headerTitle}>Organizer Portal</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/events/create')}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.createBtnText}>New Event</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <TrendingUp size={18} color={colors.primary} />
          </View>
          <Text style={styles.metricValue}>{formatNaira(totalGrossKobo)}</Text>
          <Text style={styles.metricLabel}>Gross Sales</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <Users size={18} color={colors.accent} />
          </View>
          <Text style={styles.metricValue}>{totalTicketsSold.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>Tickets Sold</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <Calendar size={18} color={colors.success} />
          </View>
          <Text style={styles.metricValue}>{events.length}</Text>
          <Text style={styles.metricLabel}>Total Events</Text>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your events..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.tabsRow}>
          {(['all', 'published', 'draft', 'cancelled'] as const).map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => setStatusFilter(tab)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Events List */}
      {isLoading ? (
        <LoadingState message="Loading your events..." />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          title="No Events Found"
          message={
            searchQuery || statusFilter !== 'all'
              ? 'No events match your search or filter.'
              : 'You have not created any events yet. Tap "+ New Event" to publish your first event on TixNaija!'
          }
        />
      ) : (
        <FlatList
          data={filteredEvents}
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
            const dateStr = new Date(item.start_datetime).toLocaleDateString('en-NG', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            const timeStr = new Date(item.start_datetime).toLocaleTimeString('en-NG', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View style={styles.eventCard}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => router.push(`/events/${item.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={
                      item.cover_image_url
                        ? { uri: item.cover_image_url }
                        : require('../../assets/adaptive-icon.png')
                    }
                    style={styles.coverThumbnail}
                  />
                  <View style={styles.eventInfo}>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          item.status === 'published' && styles.statusPublished,
                          item.status === 'draft' && styles.statusDraft,
                          item.status === 'cancelled' && styles.statusCancelled,
                        ]}
                      >
                        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.grossText}>{formatNaira(item.gross_kobo)}</Text>
                    </View>

                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <View style={styles.detailRow}>
                      <Clock size={12} color={colors.textMuted} />
                      <Text style={styles.detailText}>
                        {dateStr} • {timeStr}
                      </Text>
                    </View>

                    {item.venue_name && (
                      <View style={styles.detailRow}>
                        <MapPin size={12} color={colors.textMuted} />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {item.venue_name}
                          {item.city ? `, ${item.city}` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Ticket Progress */}
                <View style={styles.progressSection}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>Tickets Sold</Text>
                    <Text style={styles.progressCount}>
                      {item.tickets_sold} / {item.total_tickets}
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${
                            item.total_tickets > 0
                              ? Math.min(100, (item.tickets_sold / item.total_tickets) * 100)
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/events/${item.id}/attendees` as any)}
                    activeOpacity={0.7}
                  >
                    <Users size={14} color={colors.primary} />
                    <Text style={styles.actionBtnText}>Attendees</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/events/${item.id}/broadcast` as any)}
                    activeOpacity={0.7}
                  >
                    <Radio size={14} color={colors.accent} />
                    <Text style={styles.actionBtnText}>Broadcast</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/events/${item.id}/analytics` as any)}
                    activeOpacity={0.7}
                  >
                    <BarChart2 size={14} color={colors.success} />
                    <Text style={styles.actionBtnText}>Analytics</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/events/${item.id}/edit` as any)}
                    activeOpacity={0.7}
                  >
                    <Edit size={14} color={colors.textMuted} />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  metricsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 14,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  coverThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.surfaceHover,
  },
  eventInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPublished: {
    backgroundColor: `${colors.success}22`,
  },
  statusDraft: {
    backgroundColor: colors.surfaceHover,
  },
  statusCancelled: {
    backgroundColor: `${colors.error}22`,
  },
  statusText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  grossText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  eventTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  detailText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  progressCount: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surfaceHover,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
