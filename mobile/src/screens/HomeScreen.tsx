import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, SafeAreaView, Pressable, Dimensions } from 'react-native';
import { supabase } from '../../supabase/client';
import { MapPin, Calendar, ChevronRight } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = width * 0.85;
const UPCOMING_CARD_WIDTH = width * 0.6;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function FeaturedCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
      onPress={onPress}
      style={[styles.featuredCard, animatedStyle]}
    >
      <View style={styles.featuredImageContainer}>
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.featuredImage} />
        ) : (
          <View style={[styles.featuredImage, { backgroundColor: '#2C2C2E' }]} />
        )}
        <View style={styles.featuredOverlay}>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>
        </View>
      </View>
      <View style={styles.featuredDetails}>
        <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.featuredDate}>
          {new Date(item.start_datetime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

function UpcomingCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
      onPress={onPress}
      style={[styles.upcomingCard, animatedStyle]}
    >
      <View style={styles.upcomingImageContainer}>
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.upcomingImage} />
        ) : (
          <View style={[styles.upcomingImage, { backgroundColor: '#2C2C2E' }]} />
        )}
      </View>
      <View style={styles.upcomingDetails}>
        <Text style={styles.upcomingTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.metaRow}>
          <MapPin size={12} color="#8E8E93" />
          <Text style={styles.upcomingLocation} numberOfLines={1}>
            {item.venue_name || 'Online'}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_datetime, venue_name, cover_image_url')
        .eq('status', 'published')
        .order('start_datetime', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      
      const events = data || [];
      // Just visually splitting them for the UI
      setFeaturedEvents(events.slice(0, 3));
      setUpcomingEvents(events.slice(3, 10));
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Liquid Glass Header */}
      <BlurView intensity={85} tint="dark" style={[styles.headerBlur, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Discover</Text>
        </View>
      </BlurView>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Section */}
        {featuredEvents.length > 0 && (
          <View style={styles.section}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={FEATURED_CARD_WIDTH + 16}
              decelerationRate="fast"
              contentContainerStyle={styles.horizontalScrollPadding}
            >
              {featuredEvents.map((item) => (
                <FeaturedCard 
                  key={item.id} 
                  item={item} 
                  onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} 
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Upcoming Section */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Near You</Text>
              <Pressable style={styles.seeAllBtn} onPress={() => navigation.navigate('Explore')}>
                <Text style={styles.seeAllText}>See All</Text>
                <ChevronRight size={16} color="#8E8E93" />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={UPCOMING_CARD_WIDTH + 16}
              decelerationRate="fast"
              contentContainerStyle={styles.horizontalScrollPadding}
            >
              {upcomingEvents.map((item) => (
                <UpcomingCard 
                  key={item.id} 
                  item={item} 
                  onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} 
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', 
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBlur: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.8, 
  },
  scrollContent: {
    paddingTop: 110, // Space for header
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 15,
    color: '#8E8E93',
    marginRight: 2,
  },
  horizontalScrollPadding: {
    paddingHorizontal: 16,
  },
  
  // Featured Card
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    marginRight: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    overflow: 'hidden',
  },
  featuredImageContainer: {
    width: '100%',
    height: FEATURED_CARD_WIDTH * 1.1,
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  featuredBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  featuredBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  featuredDetails: {
    padding: 20,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  featuredDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f2611e',
  },

  // Upcoming Card
  upcomingCard: {
    width: UPCOMING_CARD_WIDTH,
    marginRight: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    overflow: 'hidden',
  },
  upcomingImageContainer: {
    width: '100%',
    height: UPCOMING_CARD_WIDTH,
  },
  upcomingImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  upcomingDetails: {
    padding: 12,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingLocation: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 4,
    flex: 1,
  },
  bottomPadding: {
    height: 100, // padding for bottom tab bar
  }
});
