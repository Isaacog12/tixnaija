import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Users,
  QrCode,
  Radio,
  BarChart2,
  Tag,
  Edit,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';

import { supabase } from '../../../src/supabase/client';
import { colors } from '../../../src/theme/colors';
import { LoadingState } from '../../../src/components/LoadingState';

export default function EventManagementHubScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<any>(null);
  const [ticketsSold, setTicketsSold] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [grossKobo, setGrossKobo] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadEventHub = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setEvent(data);

      let soldCount = 0;
      let capCount = 0;
      let gross = 0;

      (data.ticket_types || []).forEach((tt: any) => {
        const cap = tt.capacity || 0;
        const rem = tt.remaining !== null && tt.remaining !== undefined ? tt.remaining : cap;
        const sold = Math.max(0, cap - rem);
        const price = tt.price_kobo || 0;

        soldCount += sold;
        capCount += cap;
        gross += sold * price;
      });

      setTicketsSold(soldCount);
      setTotalCapacity(capCount);
      setGrossKobo(gross);
    } catch (err: any) {
      console.warn('Error loading event hub:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadEventHub();
  }, [loadEventHub]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadEventHub();
  };

  if (isLoading) {
    return <LoadingState message="Loading event dashboard..." />;
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Hub</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.errorText}>Event not found.</Text>
      </SafeAreaView>
    );
  }

  const formatNaira = (kobo: number) => `₦${Math.floor(kobo / 100).toLocaleString()}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/events/${id}/edit` as any)}
        >
          <Edit size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Cover Thumbnail & Header Info */}
        <View style={styles.heroCard}>
          {event.cover_image_url && (
            <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
          )}
          <View style={styles.heroInfo}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{event.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={styles.infoRow}>
              <Clock size={13} color={colors.textMuted} />
              <Text style={styles.infoText}>
                {new Date(event.start_datetime).toLocaleDateString('en-NG', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            </View>
            {event.venue_name && (
              <View style={styles.infoRow}>
                <MapPin size={13} color={colors.textMuted} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {event.venue_name}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatNaira(grossKobo)}</Text>
            <Text style={styles.metricLabel}>Gross Sales</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {ticketsSold} / {totalCapacity}
            </Text>
            <Text style={styles.metricLabel}>Tickets Sold</Text>
          </View>
        </View>

        {/* Management Tool Menus */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Tools & Actions</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push(`/events/${id}/attendees` as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${colors.primary}22` }]}>
                <Users size={18} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Attendee Roster</Text>
                <Text style={styles.menuSubtitle}>View tickets, manual check-in & reassign</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(tabs)/scan')}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${colors.success}22` }]}>
                <QrCode size={18} color={colors.success} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Gate QR Scanner</Text>
                <Text style={styles.menuSubtitle}>High-speed camera check-in with offline sync</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push(`/events/${id}/analytics` as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#EAB30822' }]}>
                <BarChart2 size={18} color="#EAB308" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Analytics & Revenue</Text>
                <Text style={styles.menuSubtitle}>Sales velocity, tier breakdown & attendance rate</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push(`/events/${id}/broadcast` as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${colors.accent}22` }]}>
                <Radio size={18} color={colors.accent} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Send Broadcast</Text>
                <Text style={styles.menuSubtitle}>Dispatch announcements to all ticket holders</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push(`/events/${id}/promos` as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${colors.primary}22` }]}>
                <Tag size={18} color={colors.primary} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Promo Codes</Text>
                <Text style={styles.menuSubtitle}>Create percentage and fixed price discounts</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push(`/events/${id}/promoters` as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${colors.accent}22` }]}>
                <Users size={18} color={colors.accent} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Promoters & Affiliates</Text>
                <Text style={styles.menuSubtitle}>Generate trackable referral links and monitor sales</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push(`/e/${event.slug}` as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.surfaceHover }]}>
                <ExternalLink size={18} color={colors.text} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>View Public Event Page</Text>
                <Text style={styles.menuSubtitle}>See the public listing as attendees see it</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  editBtn: {
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
  errorText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  heroInfo: {
    padding: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.success}22`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  statusBadgeText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '800',
  },
  eventTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 20,
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
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  menuSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
});
