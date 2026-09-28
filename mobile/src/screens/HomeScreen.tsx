import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, SafeAreaView, TextInput, Pressable } from 'react-native';
import { supabase } from '../../supabase/client';
import { MapPin, Calendar, Search } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function EventCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 20, stiffness: 400 });
      }}
      onPress={onPress}
      style={[styles.eventCard, animatedStyle]}
    >
      <View style={styles.imagePlaceholder}>
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.coverImage} />
        ) : (
          <View style={styles.placeholderBox} />
        )}
      </View>
      <View style={styles.eventDetails}>
        <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
        
        <View style={styles.metaRow}>
          <Calendar size={14} color="#f2611e" />
          <Text style={styles.eventDate}>
            {new Date(item.start_datetime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MapPin size={14} color="#c2bdb8" />
          <Text style={styles.eventLocation} numberOfLines={1}>
            {item.venue_name ? item.venue_name : 'Online Event'}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default function HomeScreen({ navigation }: any) {
  const [events, setEvents] = useState<any[]>([]);
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
        .limit(20);
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Content */}
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EventCard 
            item={item} 
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} 
          />
        )}
        contentContainerStyle={styles.listContent}
        indicatorStyle="white"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Events Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? "No events match your search." : "There are no upcoming published events right now. Check back later!"}
            </Text>
          </View>
        }
      />

      {/* Liquid Glass Header */}
      <BlurView intensity={85} tint="dark" style={styles.headerBlur}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Discover</Text>
            
            <View style={styles.searchContainer}>
              <Search color="#8E8E93" size={20} style={styles.searchIcon} />
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
        </SafeAreaView>
      </BlurView>
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
    top: 0,
    left: 0,
    right: 0,
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
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.24)', // iOS standard search bar fill over blur
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
  listContent: {
    paddingTop: 160, // Space for the absolute Liquid Glass header
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20, 
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    height: 200, 
    backgroundColor: '#2C2C2E',
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderBox: {
    flex: 1,
    backgroundColor: '#2C2C2E',
  },
  eventDetails: {
    padding: 16,
    paddingTop: 14,
  },
  eventTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.3, 
    lineHeight: 24, 
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f2611e',
    marginLeft: 6,
  },
  eventLocation: {
    fontSize: 15,
    color: '#8E8E93', 
    marginLeft: 6,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptyText: {
    color: '#8E8E93',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
});
