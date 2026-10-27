import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Calendar, MapPin, Tag } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { formatEventDate, formatEventTime } from '../utils/date';
import { formatNaira } from '../utils/currency';
import type { Database } from '../supabase/types';

type EventRow = Database['public']['Tables']['events']['Row'] & {
  ticket_types?: { price_kobo: number; quantity_available: number; quantity_sold: number }[];
};

interface EventCardProps {
  event: EventRow;
  onPress: () => void;
  featured?: boolean;
}

const { width } = Dimensions.get('window');

export function EventCard({ event, onPress, featured = false }: EventCardProps) {
  // Determine lowest ticket price
  let minPriceKobo = 0;
  let isFree = false;
  if (event.ticket_types && event.ticket_types.length > 0) {
    const prices = event.ticket_types.map((t) => t.price_kobo);
    minPriceKobo = Math.min(...prices);
    isFree = minPriceKobo === 0;
  }

  const categoryLabel = event.category ? event.category.toUpperCase() : 'EVENT';

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.card, featured && styles.featuredCard]}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}`}
    >
      <View style={styles.imageContainer}>
        {event.cover_image_url ? (
          <Image
            source={{ uri: event.cover_image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Tag size={32} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.badgeCategory}>
          <Text style={styles.badgeCategoryText}>{categoryLabel}</Text>
        </View>
        <View style={styles.badgePrice}>
          <Text style={styles.badgePriceText}>
            {isFree ? 'FREE' : `From ${formatNaira(minPriceKobo)}`}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.metaRow}>
          <Calendar size={14} color={colors.primary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {formatEventDate(event.start_datetime)} • {formatEventTime(event.start_datetime)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MapPin size={14} color={colors.textMuted} />
          <Text style={styles.metaTextMuted} numberOfLines={1}>
            {event.venue_name || 'Venue TBA'}
            {event.city ? `, ${event.city}` : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  featuredCard: {
    borderColor: 'rgba(242, 97, 30, 0.3)',
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surfaceElevated,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCategory: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(34, 32, 30, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeCategoryText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgePrice: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgePriceText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 24,
    marginBottom: 10,
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
});
