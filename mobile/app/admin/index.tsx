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
import { useRouter } from 'expo-router';
import {
  Users,
  Calendar,
  FileCheck2,
  Image as ImageIcon,
  Headphones,
  TrendingUp,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  Clock,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { formatNairaKobo } from '../../src/utils/currency';

interface AdminStats {
  userCount: number;
  eventCount: number;
  totalRevenueKobo: number;
  pendingApplicationsCount: number;
  activeBannersCount: number;
}

export default function AdminHubScreen() {
  const router = useRouter();
  const { isAdmin, isStaff, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<AdminStats>({
    userCount: 0,
    eventCount: 0,
    totalRevenueKobo: 0,
    pendingApplicationsCount: 0,
    activeBannersCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      setErrorMsg('');
      const [
        usersRes,
        eventsRes,
        ordersRes,
        pendingAppsRes,
        bannersRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('total_kobo').eq('status', 'paid'),
        supabase
          .from('organizer_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('sponsored_banners')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
      ]);

      const revenue = (ordersRes.data ?? []).reduce(
        (sum, order: any) => sum + (order.total_kobo || 0),
        0
      );

      setStats({
        userCount: usersRes.count ?? 0,
        eventCount: eventsRes.count ?? 0,
        totalRevenueKobo: revenue,
        pendingApplicationsCount: pendingAppsRes.count ?? 0,
        activeBannersCount: bannersRes.count ?? 0,
      });
    } catch (err: any) {
      console.warn('[AdminHub] Error fetching stats:', err);
      setErrorMsg(err.message || 'Failed to load platform stats');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin || isStaff) {
      fetchStats();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [isAdmin, isStaff, authLoading, fetchStats]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchStats();
  };

  if (authLoading || isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Admin & Staff Hub" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading platform metrics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Security gate
  if (!isAdmin && !isStaff) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Access Denied" showBack />
        <View style={styles.centered}>
          <ShieldAlert size={56} color={colors.error} />
          <Text style={styles.unauthorizedTitle}>Restricted Area</Text>
          <Text style={styles.unauthorizedSubtitle}>
            This control center is exclusively accessible to TixNaija administrators and authorized customer care personnel.
          </Text>
          <Button
            title="Return to Safety"
            variant="outline"
            onPress={() => router.replace('/(tabs)/more')}
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Admin & Staff Hub" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Banner Alert for Errors */}
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Pending Applications Notice */}
        {stats.pendingApplicationsCount > 0 && isAdmin && (
          <TouchableOpacity
            style={styles.actionBanner}
            onPress={() => router.push('/admin/applications')}
            activeOpacity={0.85}
          >
            <View style={styles.actionBannerIcon}>
              <Clock size={20} color="#f59e0b" />
            </View>
            <View style={styles.actionBannerTextContainer}>
              <Text style={styles.actionBannerTitle}>
                {stats.pendingApplicationsCount} Pending Organizer Application{stats.pendingApplicationsCount > 1 ? 's' : ''}
              </Text>
              <Text style={styles.actionBannerSubtitle}>
                Review KYC government IDs and approve new organizers
              </Text>
            </View>
            <ChevronRight size={18} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Platform Overview Metrics */}
        <Text style={styles.sectionTitle}>Platform Overview</Text>
        <View style={styles.kpiGrid}>
          {/* Gross Platform Sales */}
          <View style={[styles.kpiCard, styles.kpiCardFull]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>GROSS PLATFORM SALES</Text>
              <TrendingUp size={16} color={colors.success} />
            </View>
            <Text style={styles.kpiValueLarge}>
              {formatNairaKobo(stats.totalRevenueKobo)}
            </Text>
            <Text style={styles.kpiSubtext}>Total volume across all paid tickets</Text>
          </View>

          {/* Registered Users */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>TOTAL USERS</Text>
              <Users size={16} color={colors.primary} />
            </View>
            <Text style={styles.kpiValue}>
              {stats.userCount.toLocaleString('en-NG')}
            </Text>
            <Text style={styles.kpiSubtext}>Profiles on record</Text>
          </View>

          {/* Total Events */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>TOTAL EVENTS</Text>
              <Calendar size={16} color="#38bdf8" />
            </View>
            <Text style={styles.kpiValue}>
              {stats.eventCount.toLocaleString('en-NG')}
            </Text>
            <Text style={styles.kpiSubtext}>Drafts & published</Text>
          </View>
        </View>

        {/* Management Portals */}
        <Text style={styles.sectionTitle}>Control Centers</Text>
        <View style={styles.toolsList}>
          {/* Customer Care Universal Lookup */}
          <TouchableOpacity
            style={styles.toolCard}
            onPress={() => router.push('/support/lookup')}
            activeOpacity={0.7}
          >
            <View style={[styles.toolIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Headphones size={22} color="#38bdf8" />
            </View>
            <View style={styles.toolBody}>
              <Text style={styles.toolTitle}>Customer Care Universal Lookup</Text>
              <Text style={styles.toolSubtitle}>
                Instant search across buyer emails, payment refs, phone numbers & ticket UUIDs. Resend ticket confirmation emails.
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Organizer KYC Applications */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => router.push('/admin/applications')}
              activeOpacity={0.7}
            >
              <View style={[styles.toolIconWrap, { backgroundColor: 'rgba(242, 97, 30, 0.15)' }]}>
                <FileCheck2 size={22} color={colors.primary} />
              </View>
              <View style={styles.toolBody}>
                <View style={styles.toolHeaderRow}>
                  <Text style={styles.toolTitle}>Organizer KYC Applications</Text>
                  {stats.pendingApplicationsCount > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>
                        {stats.pendingApplicationsCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.toolSubtitle}>
                  Review submitted government IDs, social proof, approve organizer rights or reject with audit notes.
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Sponsored Banners */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => router.push('/admin/banners')}
              activeOpacity={0.7}
            >
              <View style={[styles.toolIconWrap, { backgroundColor: 'rgba(46, 213, 115, 0.15)' }]}>
                <ImageIcon size={22} color={colors.success} />
              </View>
              <View style={styles.toolBody}>
                <View style={styles.toolHeaderRow}>
                  <Text style={styles.toolTitle}>Sponsored Hero Banners</Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>
                      {stats.activeBannersCount} Active
                    </Text>
                  </View>
                </View>
                <Text style={styles.toolSubtitle}>
                  Manage discover-page hero ad slots, reorder promotions, upload creative artwork & monitor clicks.
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* User Directory & Access Management */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.toolCard}
              onPress={() => router.push('/admin/users')}
              activeOpacity={0.7}
            >
              <View style={[styles.toolIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Users size={22} color="#a855f7" />
              </View>
              <View style={styles.toolBody}>
                <Text style={styles.toolTitle}>User Directory & Permissions</Text>
                <Text style={styles.toolSubtitle}>
                  Inspect user accounts, suspend abusive accounts, and grant verified organizer badges.
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Footer info */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>TixNaija Security Policy Enforcement</Text>
          <Text style={styles.footerSubtext}>
            All administrative and customer care actions are protected by PostgreSQL Row-Level Security and logged to immutable audit records.
          </Text>
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
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  unauthorizedSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 90, 90, 0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  actionBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBannerTextContainer: {
    flex: 1,
  },
  actionBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  actionBannerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCardFull: {
    width: '100%',
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  kpiValueLarge: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 4,
  },
  kpiSubtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
  toolsList: {
    gap: 12,
    marginBottom: 28,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBody: {
    flex: 1,
  },
  toolHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  toolSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  pendingBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  activePill: {
    backgroundColor: 'rgba(46, 213, 115, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.success,
  },
  footerNote: {
    marginTop: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  footerSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
});
