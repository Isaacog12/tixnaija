import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Pressable, Dimensions, TextInput } from 'react-native';
import { supabase } from '../../supabase/client';
import { MapPin, ChevronRight, Search } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const FEATURED_CARD_WIDTH = width * 0.88;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function FeaturedCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => { scale.value = withSpring(0.96, { damping: 24, stiffness: 300 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 24, stiffness: 300 }); };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[styles.featuredCard, animatedStyle]}
    >
      <View style={styles.featuredImageContainer}>
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.featuredImage} />
        ) : (
          <View style={[styles.featuredImage, { backgroundColor: '#2C2C2E' }]} />
        )}
      </View>
      
      <BlurView intensity={70} tint="dark" style={styles.featuredBadge}>
        <Text style={styles.featuredBadgeText}>FEATURED</Text>
      </BlurView>

      <BlurView intensity={80} tint="dark" style={styles.featuredBlurPlate}>
        <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.featuredDate}>
          {new Date(item.start_datetime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
      </BlurView>
    </AnimatedPressable>
  );
}

function UpcomingRow({ item, onPress, isLast }: { item: any; onPress: () => void; isLast: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 24, stiffness: 300 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 24, stiffness: 300 }); };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[styles.upcomingRow, animatedStyle]}
    >
      <View style={styles.upcomingImageContainer}>
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.upcomingRowImage} />
        ) : (
          <View style={[styles.upcomingRowImage, { backgroundColor: '#2C2C2E' }]} />
        )}
      </View>
      
      <View style={[styles.upcomingContent, !isLast && styles.upcomingDivider]}>
        <View style={styles.upcomingTextCol}>
          <Text style={styles.upcomingDateTop}>
            {new Date(item.start_datetime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          </Text>
          <Text style={styles.upcomingRowTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.metaRow}>
            <MapPin size={12} color="#8E8E93" />
            <Text style={styles.upcomingLocation} numberOfLines={1}>
              {item.venue_name || 'Online'}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color="#3A3A3C" />
      </View>
    </AnimatedPressable>
  );
}

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
        .limit(30);
      
      if (error) throw error;
      
      const events = data || [];
      setAllEvents(events);
      setFeaturedEvents(events.slice(0, 3));
      setUpcomingEvents(events.slice(3, 10));
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSearching = searchQuery.trim().length > 0;
  const filteredEvents = isSearching 
    ? allEvents.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={90} tint="dark" style={[styles.headerBlur, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={styles.searchContainer}>
            <Search color="#8E8E93" size={18} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events"
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      </BlurView>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isSearching ? (
          <View style={styles.upcomingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Search Results</Text>
            </View>
            <View style={styles.listContainer}>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((item, index) => (
                  <UpcomingRow 
                    key={item.id} 
                    item={item} 
                    onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
                    isLast={index === filteredEvents.length - 1}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No events match your search.</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            {/* Featured Section (Horizontal) */}
            {featuredEvents.length > 0 && (
              <View style={styles.featuredSection}>
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

            {/* Upcoming Section (Vertical List) */}
            {upcomingEvents.length > 0 && (
              <View style={styles.upcomingSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Up Next</Text>
                </View>
                
                <View style={styles.listContainer}>
                  {upcomingEvents.map((item, index) => (
                    <UpcomingRow 
                      key={item.id} 
                      item={item} 
                      onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
                      isLast={index === upcomingEvents.length - 1}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
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
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 36,
  },
  searchIcon: {
    marginHorizontal: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 17, 
    color: '#ffffff',
    paddingVertical: 0,
    height: '100%',
  },
  scrollContent: {
    paddingTop: 160, // Space for header + search bar
  },
  
  // Featured Section
  featuredSection: {
    marginBottom: 40,
  },
  horizontalScrollPadding: {
    paddingHorizontal: 20,
    paddingRight: 40, // Extra padding at the end of the scroll
  },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    height: FEATURED_CARD_WIDTH * 1.25, // Taller, immersive card
    marginRight: 16,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  featuredImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featuredBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  featuredBadgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  featuredBlurPlate: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  featuredDate: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f2611e',
  },

  // Upcoming Section
  upcomingSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  seeAllBtn: {
    paddingBottom: 2,
  },
  seeAllText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#f2611e',
  },
  listContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    overflow: 'hidden',
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    backgroundColor: '#1C1C1E',
  },
  upcomingImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 12,
  },
  upcomingRowImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  upcomingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingRight: 16,
    marginLeft: 16,
  },
  upcomingDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  upcomingTextCol: {
    flex: 1,
    marginRight: 12,
  },
  upcomingDateTop: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f2611e',
    marginBottom: 4,
  },
  upcomingRowTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  bottomPadding: {
    height: 120, // padding for bottom tab bar
  }
});
