import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, SafeAreaView } from 'react-native';
import { supabase } from '../../supabase/client';
import { MapPin, Calendar } from 'lucide-react-native';

export default function HomeScreen({ navigation }: any) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_datetime, location_type, venue_name, cover_image_url')
        .eq('status', 'published')
        .order('start_datetime', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderEvent = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.eventCard}
      onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      activeOpacity={0.8}
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
            {item.location_type === 'physical' ? item.venue_name : 'Online Event'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Discover</Text>
            <Text style={styles.headerSubtitle}>Find the best events happening around you</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Events Found</Text>
            <Text style={styles.emptyText}>There are no upcoming published events right now. Check back later!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
    paddingHorizontal: 8,
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#a1a1aa',
    marginTop: 6,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  imagePlaceholder: {
    height: 180,
    backgroundColor: '#2a2a2a',
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderBox: {
    flex: 1,
    backgroundColor: '#2a2a2a',
  },
  eventDetails: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f2611e',
    marginLeft: 6,
  },
  eventLocation: {
    fontSize: 14,
    color: '#c2bdb8',
    marginLeft: 6,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyText: {
    color: '#a1a1aa',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
});
