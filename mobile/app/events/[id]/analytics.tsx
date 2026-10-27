import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  CheckCircle2,
  Percent,
  Tag,
  DollarSign,
  ChevronRight,
  BarChart,
  Eye,
} from 'lucide-react-native';

import { supabase } from '../../../src/supabase/client';
import { colors } from '../../../src/theme/colors';
import { LoadingState } from '../../../src/components/LoadingState';

interface TierStat {
  id: string;
  name: string;
  price_kobo: number;
  capacity: number;
  remaining: number;
  sold: number;
  revenue_kobo: number;
}

interface PromoStat {
  code: string;
  times_used: number;
  discount_type: string;
  discount_value: number;
}

export default function EventAnalyticsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [eventTitle, setEventTitle] = useState('');
  const [totalGrossKobo, setTotalGrossKobo] = useState(0);
  const [totalSold, setTotalSold] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [pageViewsCount, setPageViewsCount] = useState(0);
  const [tierStats, setTierStats] = useState<TierStat[]>([]);
  const [promos, setPromos] = useState<PromoStat[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    try {
      // 1. Fetch Event Title
      const { data: eventData } = await supabase
        .from('events')
        .select('title')
        .eq('id', id)
        .single();

      if (eventData) setEventTitle(eventData.title);

      // 2. Fetch Ticket Tiers
      const { data: tiersData, error: tErr } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', id);

      if (tErr) throw tErr;

      let gross = 0;
      let soldTotal = 0;
      let capTotal = 0;

      const tiersFormatted: TierStat[] = (tiersData || []).map((t: any) => {
        const cap = t.capacity || 0;
        const rem = t.remaining !== null && t.remaining !== undefined ? t.remaining : cap;
        const sold = Math.max(0, cap - rem);
        const rev = sold * (t.price_kobo || 0);

        gross += rev;
        soldTotal += sold;
        capTotal += cap;

        return {
          id: t.id,
          name: t.name,
          price_kobo: t.price_kobo || 0,
          capacity: cap,
          remaining: rem,
          sold,
          revenue_kobo: rev,
        };
      });

      setTierStats(tiersFormatted);
      setTotalGrossKobo(gross);
      setTotalSold(soldTotal);
      setTotalCapacity(capTotal);

      // 3. Fetch Checked In Tickets count
      const { count: checkInCount } = await supabase
        .from('tickets')
        .select('id, order_items!inner(ticket_types!inner(event_id))', { count: 'exact', head: true })
        .eq('order_items.ticket_types.event_id', id)
        .eq('status', 'checked_in');

      setCheckedInCount(checkInCount || 0);

      // 4. Fetch Page Views count
      const { count: viewsCount } = await supabase
        .from('event_page_views')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id);

      setPageViewsCount(viewsCount || 0);

      // 5. Fetch Promos
      const { data: promosData } = await supabase
        .from('promo_codes')
        .select('code, times_used, discount_type, discount_value')
        .eq('event_id', id);

      setPromos(promosData || []);
    } catch (err: any) {
      console.warn('Analytics load error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAnalytics();
  };

  const formatNaira = (kobo: number) => {
    return `₦${Math.floor(kobo / 100).toLocaleString()}`;
  };

  const attendanceRate = totalSold > 0 ? Math.round((checkedInCount / totalSold) * 100) : 0;

  if (isLoading) {
    return <LoadingState message="Calculating analytics..." />;
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
        <Text style={styles.headerTitle}>Event Analytics</Text>
        <View style={{ width: 36 }} />
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
        <Text style={styles.eventHeading} numberOfLines={1}>
          {eventTitle || 'Event Performance'}
        </Text>

        {/* 4 Metric Cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.gridCard}>
            <View style={styles.gridIconBox}>
              <TrendingUp size={18} color={colors.primary} />
            </View>
            <Text style={styles.gridValue}>{formatNaira(totalGrossKobo)}</Text>
            <Text style={styles.gridLabel}>Gross Revenue</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridIconBox}>
              <Users size={18} color={colors.accent} />
            </View>
            <Text style={styles.gridValue}>
              {totalSold} <Text style={styles.gridValueSub}>/ {totalCapacity}</Text>
            </Text>
            <Text style={styles.gridLabel}>Tickets Sold</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridIconBox}>
              <CheckCircle2 size={18} color={colors.success} />
            </View>
            <Text style={styles.gridValue}>{attendanceRate}%</Text>
            <Text style={styles.gridLabel}>Gate Attendance</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridIconBox}>
              <DollarSign size={18} color="#EAB308" />
            </View>
            <Text style={styles.gridValue}>
              {totalSold > 0 ? formatNaira(Math.round(totalGrossKobo / totalSold)) : '₦0'}
            </Text>
            <Text style={styles.gridLabel}>Avg. Ticket Value</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridIconBox}>
              <Eye size={18} color={colors.accent} />
            </View>
            <Text style={styles.gridValue}>{pageViewsCount.toLocaleString()}</Text>
            <Text style={styles.gridLabel}>Page Views</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.gridIconBox}>
              <Percent size={18} color={colors.success} />
            </View>
            <Text style={styles.gridValue}>
              {pageViewsCount > 0
                ? `${Math.min(100, Math.round((totalSold / pageViewsCount) * 100))}%`
                : '0%'}
            </Text>
            <Text style={styles.gridLabel}>Page Conversion</Text>
          </View>
        </View>

        {/* Ticket Tier Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sales by Ticket Tier</Text>
          <View style={styles.card}>
            {tierStats.length === 0 ? (
              <Text style={styles.emptyText}>No ticket tiers configured.</Text>
            ) : (
              tierStats.map((tier, idx) => {
                const soldPct =
                  tier.capacity > 0 ? Math.min(100, (tier.sold / tier.capacity) * 100) : 0;
                return (
                  <View
                    key={tier.id}
                    style={[styles.tierRow, idx > 0 && styles.tierRowDivider]}
                  >
                    <View style={styles.tierTop}>
                      <View>
                        <Text style={styles.tierName}>{tier.name}</Text>
                        <Text style={styles.tierPrice}>
                          {tier.price_kobo === 0 ? 'Free' : formatNaira(tier.price_kobo)} each
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.tierRevenue}>
                          {formatNaira(tier.revenue_kobo)}
                        </Text>
                        <Text style={styles.tierSoldText}>
                          {tier.sold} / {tier.capacity} sold
                        </Text>
                      </View>
                    </View>

                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${soldPct}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Promo Codes Summary & Link */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Promo Codes</Text>
            <TouchableOpacity
              style={styles.managePromosLink}
              onPress={() => router.push(`/events/${id}/promos` as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.managePromosText}>Manage Promos</Text>
              <ChevronRight size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {promos.length === 0 ? (
              <Text style={styles.emptyText}>No promo codes created for this event yet.</Text>
            ) : (
              promos.map((p, idx) => (
                <View
                  key={p.code}
                  style={[styles.promoRow, idx > 0 && styles.tierRowDivider]}
                >
                  <View style={styles.promoCodeBadge}>
                    <Tag size={12} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.promoCodeText}>{p.code}</Text>
                  </View>
                  <Text style={styles.promoUses}>Used {p.times_used} times</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Promoters & Affiliates Summary & Link */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Promoters & Affiliates</Text>
            <TouchableOpacity
              style={styles.managePromosLink}
              onPress={() => router.push(`/events/${id}/promoters` as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.managePromosText}>Manage Promoters</Text>
              <ChevronRight size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              Track sales attribution, influencer revenue, and active referral links.
            </Text>
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
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  eventHeading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    width: '48%',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  gridValueSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  gridLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  managePromosLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  managePromosText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  tierRow: {
    paddingVertical: 8,
  },
  tierRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  tierTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tierName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  tierPrice: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  tierRevenue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  tierSoldText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  barBg: {
    height: 6,
    backgroundColor: colors.surfaceHover,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  promoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  promoCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}22`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  promoCodeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  promoUses: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
