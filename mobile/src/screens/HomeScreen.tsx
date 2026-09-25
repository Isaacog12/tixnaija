import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '../../supabase/client';
import Animated, { FadeIn } from 'react-native-reanimated';

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
        .select('id, title, start_datetime, location_type, venue_name')
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
    >
      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventDate}>
        {new Date(item.start_datetime).toLocaleDateString()}
      </Text>
      <Text style={styles.eventLocation}>
        {item.location_type === 'physical' ? item.venue_name : 'Online Event'}
      </Text>
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
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.headerTitle}>Upcoming Events</Text>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No upcoming events found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#22201e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 16,
  },
  eventCard: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#f2611e',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#c2bdb8',
  },
  emptyText: {
    color: '#c2bdb8',
    textAlign: 'center',
    marginTop: 32,
  },
});
