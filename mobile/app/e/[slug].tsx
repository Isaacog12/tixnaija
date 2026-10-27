import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calendar,
  MapPin,
  Share2,
  Minus,
  Plus,
  ShieldCheck,
  Tag,
  ArrowLeft,
  Users,
} from 'lucide-react-native';
import { supabase } from '../../src/supabase/client';
import { useAuth } from '../../src/context/AuthContext';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { Button } from '../../src/components/Button';
import { colors } from '../../src/theme/colors';
import { formatEventDate, formatEventTime } from '../../src/utils/date';
import { formatNaira } from '../../src/utils/currency';

const { width } = Dimensions.get('window');

export default function EventDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Selected tickets state: { [ticketTypeId]: count }
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});

  // 1. Fetch event and ticket tiers
  const fetchEventData = async () => {
    if (!slug) throw new Error('Event identifier is missing.');

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select(`
        *,
        profiles:organizer_id (
          id,
          full_name,
          avatar_url,
          bio,
          organizer_slug,
          is_verified_organizer
        )
      `)
      .eq('slug', slug)
      .single();

    if (eventErr || !event) throw eventErr || new Error('Event not found.');

    const { data: ticketTypes, error: typesErr } = await supabase
      .from('ticket_types')
      .select('*')
      .eq('event_id', event.id)
      .order('price_kobo', { ascending: true });

    if (typesErr) throw typesErr;

    // Optional: Social proof public attendees
    let attendees: any[] = [];
    try {
      const { data: socialData } = await supabase.rpc('get_event_attendees' as any, {
        p_event_id: event.id,
      });
      if (socialData && Array.isArray(socialData)) {
        attendees = socialData;
      }
    } catch {
      // Non-blocking if social proof RPC is unavailable
    }

    return {
      event,
      organizer: event.profiles as any,
      ticketTypes: ticketTypes || [],
      attendees,
    };
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['event', slug],
    queryFn: fetchEventData,
    enabled: Boolean(slug),
  });

  // Share event
  const handleShare = async () => {
    if (!data?.event) return;
    try {
      await Share.share({
        title: data.event.title,
        message: `Get tickets for ${data.event.title} on TixNaija: https://tixnaija.name.ng/e/${data.event.slug}`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const updateCount = (tierId: string, delta: number, maxAvailable: number, maxPerOrder: number) => {
    setSelectedCounts((prev) => {
      const current = prev[tierId] || 0;
      const limit = Math.min(maxAvailable, maxPerOrder || 10);
      const next = Math.max(0, Math.min(limit, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[tierId];
        return copy;
      }
      return { ...prev, [tierId]: next };
    });
  };

  // Calculations for total tickets and price
  const { totalTicketCount, totalAmountKobo, selectedTiersPayload } = useMemo(() => {
    if (!data?.ticketTypes) {
      return { totalTicketCount: 0, totalAmountKobo: 0, selectedTiersPayload: [] };
    }

    let count = 0;
    let totalKobo = 0;
    const payload: { ticketTypeId: string; count: number; name: string; price_kobo: number }[] = [];

    for (const tier of data.ticketTypes) {
      const qty = selectedCounts[tier.id] || 0;
      if (qty > 0) {
        count += qty;
        totalKobo += qty * tier.price_kobo;
        payload.push({
          ticketTypeId: tier.id,
          count: qty,
          name: tier.name,
          price_kobo: tier.price_kobo,
        });
      }
    }

    return {
      totalTicketCount: count,
      totalAmountKobo: totalKobo,
      selectedTiersPayload: payload,
    };
  }, [data?.ticketTypes, selectedCounts]);

  const handleProceedToCheckout = () => {
    if (totalTicketCount === 0 || !data?.event) return;

    // Enforce login requirement per master plan rule
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'You must sign in to your TixNaija account to purchase or claim tickets.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => router.push('/(auth)/login'),
          },
        ]
      );
      return;
    }

    // Navigate to checkout screen with eventId and selected tickets
    router.push({
      pathname: '/checkout/[eventId]' as any,
      params: {
        eventId: data.event.id,
        ticketsPayload: JSON.stringify(selectedTiersPayload),
        totalAmountKobo: String(totalAmountKobo),
      },
    });
  };

  if (isLoading) {
    return <LoadingState message="Loading event details..." />;
  }

  if (isError || !data?.event) {
    return (
      <ErrorState
        title="Event not found"
        message={(error as any)?.message || 'This event may have been removed or unpublished.'}
        onRetry={refetch}
      />
    );
  }

  const { event, organizer, ticketTypes, attendees } = data;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: totalTicketCount > 0 ? 120 + insets.bottom : 40 + insets.bottom },
        ]}
      >
        {/* Cover Hero Image */}
        <View style={styles.heroContainer}>
          {event.cover_image_url ? (
            <Image
              source={{ uri: event.cover_image_url }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Tag size={48} color={colors.textMuted} />
            </View>
          )}

          {/* Floating Back and Share buttons */}
          <SafeAreaView style={styles.navBarFloating}>
            <TouchableOpacity
              style={styles.floatingCircleBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingCircleBtn}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share event"
            >
              <Share2 size={20} color={colors.text} />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Category Badge */}
          {event.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{event.category.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Date & Location Cards */}
          <View style={styles.metaBox}>
            <View style={styles.metaRow}>
              <View style={styles.metaIcon}>
                <Calendar size={18} color={colors.primary} />
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaHeader}>Date & Time</Text>
                <Text style={styles.metaValue}>
                  {formatEventDate(event.start_datetime)}
                </Text>
                <Text style={styles.metaSub}>
                  {formatEventTime(event.start_datetime)}
                  {event.end_datetime ? ` – ${formatEventTime(event.end_datetime)}` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.metaDivider} />

            <View style={styles.metaRow}>
              <View style={styles.metaIcon}>
                <MapPin size={18} color={colors.primary} />
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaHeader}>Location</Text>
                <Text style={styles.metaValue}>{event.venue_name || 'Venue TBA'}</Text>
                {event.city ? (
                  <Text style={styles.metaSub}>
                    {event.address ? `${event.address}, ` : ''}{event.city}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Organizer Card */}
          {organizer ? (
            <TouchableOpacity
              style={styles.organizerCard}
              activeOpacity={0.8}
              onPress={() => {
                if (organizer.organizer_slug) {
                  router.push(`/box-office/${organizer.organizer_slug}` as any);
                }
              }}
            >
              <View style={styles.organizerAvatar}>
                {organizer.avatar_url ? (
                  <Image source={{ uri: organizer.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>
                    {organizer.full_name?.charAt(0).toUpperCase() || 'O'}
                  </Text>
                )}
              </View>
              <View style={styles.organizerInfo}>
                <Text style={styles.organizerLabel}>Organized by</Text>
                <View style={styles.nameVerifiedRow}>
                  <Text style={styles.organizerName}>{organizer.full_name || 'Event Organizer'}</Text>
                  {organizer.is_verified_organizer ? (
                    <ShieldCheck size={16} color={colors.primary} />
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Social Proof (Public Attendees) */}
          {attendees && attendees.length > 0 ? (
            <View style={styles.socialProofBox}>
              <Users size={18} color={colors.primary} />
              <Text style={styles.socialProofText}>
                <Text style={styles.boldText}>{attendees.length}</Text> attendee
                {attendees.length > 1 ? 's' : ''} publicly registered
              </Text>
            </View>
          ) : null}

          {/* Description */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>About this Event</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          ) : null}

          {/* Ticket Selection Section */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Select Tickets</Text>

            {ticketTypes.length === 0 ? (
              <Text style={styles.noTicketsText}>No ticket tiers available for this event.</Text>
            ) : (
              ticketTypes.map((tier) => {
                const remaining =
                  tier.quantity_available - (tier.quantity_sold - (tier.quantity_cancelled || 0));
                const isSoldOut = remaining <= 0;
                const count = selectedCounts[tier.id] || 0;
                const limit = Math.min(remaining, tier.max_per_order || 10);

                return (
                  <View
                    key={tier.id}
                    style={[styles.ticketCard, isSoldOut && styles.ticketCardSoldOut]}
                  >
                    <View style={styles.ticketInfoCol}>
                      <Text style={styles.tierName}>{tier.name}</Text>
                      {tier.description ? (
                        <Text style={styles.tierDesc}>{tier.description}</Text>
                      ) : null}
                      <Text style={styles.tierPrice}>
                        {tier.price_kobo === 0 ? 'FREE' : formatNaira(tier.price_kobo)}
                      </Text>
                      {remaining > 0 && remaining <= 10 ? (
                        <Text style={styles.lowStockText}>Only {remaining} left!</Text>
                      ) : null}
                    </View>

                    {isSoldOut ? (
                      <View style={styles.soldOutBadge}>
                        <Text style={styles.soldOutText}>SOLD OUT</Text>
                      </View>
                    ) : (
                      <View style={styles.counterRow}>
                        <TouchableOpacity
                          style={[styles.counterBtn, count === 0 && styles.counterBtnDisabled]}
                          disabled={count === 0}
                          onPress={() => updateCount(tier.id, -1, remaining, tier.max_per_order)}
                          accessibilityRole="button"
                          accessibilityLabel="Decrease quantity"
                        >
                          <Minus size={16} color={count === 0 ? colors.textMuted : colors.text} />
                        </TouchableOpacity>

                        <Text style={styles.counterValue}>{count}</Text>

                        <TouchableOpacity
                          style={[
                            styles.counterBtn,
                            count >= limit && styles.counterBtnDisabled,
                          ]}
                          disabled={count >= limit}
                          onPress={() => updateCount(tier.id, 1, remaining, tier.max_per_order)}
                          accessibilityRole="button"
                          accessibilityLabel="Increase quantity"
                        >
                          <Plus
                            size={16}
                            color={count >= limit ? colors.textMuted : colors.text}
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Checkout Bar */}
      {totalTicketCount > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.bottomBarInfo}>
            <Text style={styles.bottomBarCount}>
              {totalTicketCount} ticket{totalTicketCount > 1 ? 's' : ''}
            </Text>
            <Text style={styles.bottomBarTotal}>
              {totalAmountKobo === 0 ? 'FREE' : formatNaira(totalAmountKobo)}
            </Text>
          </View>
          <Button
            title="Checkout"
            variant="primary"
            size="md"
            onPress={handleProceedToCheckout}
            style={styles.checkoutBtn}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroContainer: {
    width: '100%',
    height: width * 0.68,
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBarFloating: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 12 : 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  floatingCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 32, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(34, 32, 30, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  contentBody: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 20,
  },
  metaBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  metaIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  metaCol: {
    flex: 1,
  },
  metaHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  metaSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  organizerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  organizerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  organizerInfo: {
    flex: 1,
  },
  organizerLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  organizerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  socialProofBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(242, 97, 30, 0.2)',
  },
  socialProofText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  boldText: {
    color: colors.text,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  noTicketsText: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketCardSoldOut: {
    opacity: 0.6,
  },
  ticketInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  tierDesc: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 6,
  },
  tierPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  lowStockText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 4,
  },
  soldOutBadge: {
    backgroundColor: 'rgba(229, 90, 90, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  soldOutText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnDisabled: {
    opacity: 0.4,
  },
  counterValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    minWidth: 36,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingHorizontal: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  bottomBarInfo: {
    flex: 1,
  },
  bottomBarCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  bottomBarTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  checkoutBtn: {
    minWidth: 130,
  },
});
