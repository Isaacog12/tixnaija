import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  MapPin,
  ExternalLink,
  Share2,
} from 'lucide-react-native';

import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { EventCard } from '../../src/components/EventCard';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';

interface OrganizerProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  organizer_slug: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  is_verified_organizer: boolean | null;
}

export default function BoxOfficeScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const loadOrganizerData = async () => {
      try {
        const rawParam = slug.trim().toLowerCase();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          slug.trim()
        );

        let query = supabase.from('profiles').select('*');
        if (isUuid) {
          query = query.or(`organizer_slug.eq.${rawParam},id.eq.${slug.trim()}`);
        } else {
          query = query.or(`organizer_slug.eq.${rawParam},username.eq.${rawParam}`);
        }

        const { data: prof, error: profErr } = await query.maybeSingle();
        if (profErr || !prof) throw new Error('Organizer not found');

        setProfile(prof as any);

        // Fetch their published events
        const { data: eventsData, error: evErr } = await supabase
          .from('events')
          .select(`
            id,
            title,
            slug,
            city,
            state,
            venue_name,
            start_datetime,
            cover_image_url,
            category,
            ticket_types (price_kobo)
          `)
          .eq('organizer_id', prof.id)
          .eq('status', 'published')
          .order('start_datetime', { ascending: true });

        if (evErr) throw evErr;
        setEvents(eventsData || []);
      } catch (err: any) {
        console.warn('Box office load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrganizerData();
  }, [slug]);

  if (isLoading) {
    return <LoadingState message="Loading organizer box office..." />;
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Box Office</Text>
          <View style={{ width: 36 }} />
        </View>
        <EmptyState
          title="Organizer Not Found"
          message="We could not find an organizer profile matching this link."
        />
      </SafeAreaView>
    );
  }

  const displayName = profile.full_name || profile.username || 'TixNaija Organizer';

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
        <Text style={styles.headerTitle}>Box Office</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner / Avatar Header */}
        <View style={styles.profileHero}>
          {profile.banner_url ? (
            <Image source={{ uri: profile.banner_url }} style={styles.bannerImage} />
          ) : (
            <View style={styles.bannerPlaceholder} />
          )}

          <View style={styles.avatarWrapper}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {displayName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Organizer Details */}
        <View style={styles.detailsSection}>
          <View style={styles.nameRow}>
            <Text style={styles.organizerName}>{displayName}</Text>
            {profile.is_verified_organizer && (
              <BadgeCheck size={20} color={colors.primary} style={{ marginLeft: 6 }} />
            )}
          </View>

          {profile.username && (
            <Text style={styles.usernameText}>@{profile.username}</Text>
          )}

          {profile.bio && <Text style={styles.bioText}>{profile.bio}</Text>}

          <View style={styles.eventsCountBadge}>
            <Calendar size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.eventsCountText}>
              {events.length} Upcoming {events.length === 1 ? 'Event' : 'Events'}
            </Text>
          </View>
        </View>

        {/* Event List */}
        <View style={styles.eventsSection}>
          <Text style={styles.eventsHeading}>Events</Text>
          {events.length === 0 ? (
            <Text style={styles.noEventsText}>No published events right now.</Text>
          ) : (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/e/${event.slug}` as any)}
              />
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
    paddingBottom: 40,
  },
  profileHero: {
    position: 'relative',
    marginBottom: 44,
  },
  bannerImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceHover,
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -36,
    left: 20,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.background,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 76,
    height: 76,
  },
  avatarFallback: {
    width: 76,
    height: 76,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  usernameText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 8,
  },
  bioText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  eventsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  eventsCountText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  eventsSection: {
    paddingHorizontal: 16,
    gap: 14,
  },
  eventsHeading: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  noEventsText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
