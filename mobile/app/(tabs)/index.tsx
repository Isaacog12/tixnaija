import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Image,
  Dimensions,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Search, X, WifiOff, MapPin, Calendar, Tag } from 'lucide-react-native';
import { supabase } from '../../src/supabase/client';
import { EventCard } from '../../src/components/EventCard';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { colors } from '../../src/theme/colors';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  'All',
  'Music',
  'Comedy',
  'Conference',
  'Party',
  'Campus',
  'Church',
  'Sport',
  'Other',
];

const CACHE_KEY = '@home_events_cache';
const PAGE_SIZE = 10;

export default function HomeScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [paginatedEvents, setPaginatedEvents] = useState<any[]>([]);

  // Fetch initial events
  const fetchEvents = async () => {
    try {
      let query = supabase
        .from('events')
        .select(`
          *,
          ticket_types (
            price_kobo,
            quantity_available,
            quantity_sold
          )
        `)
        .eq('status', 'published')
        .gte('end_datetime', new Date().toISOString())
        .order('start_datetime', { ascending: true })
        .range(0, PAGE_SIZE - 1);

      const { data, error } = await query;
      if (error) throw error;

      setPage(0);
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setPaginatedEvents(data || []);

      // Save first page to cache for offline availability
      if (data && data.length > 0) {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
      setIsOffline(false);
      return data || [];
    } catch (err) {
      // Try to load cached data when offline
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setIsOffline(true);
        const parsed = JSON.parse(cached);
        setPaginatedEvents(parsed);
        return parsed;
      }
      throw err;
    }
  };

  const {
    data: events,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });

  // Load next page
  const loadMoreEvents = async () => {
    if (isLoadingMore || !hasMore || isOffline) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (
            price_kobo,
            quantity_available,
            quantity_sold
          )
        `)
        .eq('status', 'published')
        .gte('end_datetime', new Date().toISOString())
        .order('start_datetime', { ascending: true })
        .range(from, to);

      if (error) throw error;

      if (data && data.length > 0) {
        setPaginatedEvents((prev) => [...prev, ...data]);
        setPage(nextPage);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Pagination load error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Filter events by category and search query
  const displayedEvents = paginatedEvents.length > 0 ? paginatedEvents : (events || []);
  const filteredEvents = useMemo(() => {
    if (!displayedEvents) return [];
    return displayedEvents.filter((e) => {
      if (e.status !== 'published') return false;
      const start = new Date(e.start_datetime);
      const end = e.end_datetime ? new Date(e.end_datetime) : start;
      if (end < new Date()) return false;

      const matchesCategory =
        selectedCategory === 'All' ||
        e.category?.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        e.title?.toLowerCase().includes(q) ||
        e.venue_name?.toLowerCase().includes(q) ||
        e.city?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [displayedEvents, selectedCategory, searchQuery]);

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Offline banner */}
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color={colors.warning} />
          <Text style={styles.offlineText}>
            Offline Mode: Showing cached events
          </Text>
        </View>
      ) : null}

      {/* Brand & Title */}
      <View style={styles.brandRow}>
        <View>
          <Text style={styles.brandName}>TixNaija</Text>
          <Text style={styles.brandSubtitle}>Discover live experiences in Nigeria</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          placeholder="Search by event, artist, or city..."
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Categories Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.categoryPillText,
                  isActive && styles.categoryPillTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? 'Search Results' : `${selectedCategory} Events`}
        </Text>
        <Text style={styles.countBadge}>
          {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );

  if (isLoading && !events) {
    return <LoadingState message="Discovering events in Nigeria..." />;
  }

  if (isError && !events) {
    return (
      <ErrorState
        title="Could not load events"
        message={
          (error as any)?.message ||
          'Please verify your internet connection and try again.'
        }
        onRetry={refetch}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => router.push(`/e/${item.slug}` as any)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            icon={<Tag size={40} color={colors.textMuted} />}
            title="No events found"
            description={
              searchQuery
                ? `No events matching "${searchQuery}". Try different keywords.`
                : `There are currently no published ${selectedCategory} events.`
            }
            actionTitle={searchQuery || selectedCategory !== 'All' ? 'Reset Filters' : undefined}
            onAction={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
          />
        }
        contentContainerStyle={styles.listContent}
        onEndReached={loadMoreEvents}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  offlineText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  brandRow: {
    marginBottom: 16,
  },
  brandName: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  clearBtn: {
    padding: 6,
  },
  categoryScroll: {
    paddingBottom: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: colors.primaryForeground,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  countBadge: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
