import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, BarChart2, Edit, Send } from 'lucide-react-native';
import { supabase } from '../../supabase/client';

export default function MyEventsScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyEvents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('events')
        .select(`
          id, title, start_datetime, status,
          ticket_types (
            id, name, price_kobo, quantity_available
          ),
          orders (
            status,
            order_items (
              quantity,
              unit_price_kobo
            )
          )
        `)
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEvents(data);
      }
    } catch (err) {
      console.log('Error fetching my events', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchMyEvents();
    }
  }, [isFocused]);

  const renderEvent = ({ item }: { item: any }) => {
    const totalTickets = item.ticket_types?.reduce((acc: number, t: any) => acc + parseInt(t.quantity_available || '0'), 0) || 0;

    let soldTickets = 0;
    let revenueKobo = 0;
    
    if (item.orders) {
      item.orders.forEach((order: any) => {
        if (order.status === 'paid') {
          order.order_items?.forEach((oi: any) => {
            soldTickets += parseInt(oi.quantity || '0');
            revenueKobo += parseInt(oi.quantity || '0') * parseInt(oi.unit_price_kobo || '0');
          });
        }
      });
    }

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <View style={[styles.statusBadge, item.status === 'published' ? styles.statusPub : styles.statusDraft]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        
        <Text style={styles.eventDate}>{new Date(item.start_datetime).toLocaleDateString()}</Text>
        
        <View style={styles.statsContainer}>
          <Text style={styles.statText}>Capacity Remaining: {totalTickets}</Text>
          <Text style={styles.statText}>Sold Tickets: {soldTickets}</Text>
          <Text style={styles.statText}>Revenue: ₦{(revenueKobo / 100).toLocaleString()}</Text>
        </View>

        <View style={styles.actionRow}>
          {item.status === 'published' && (
            <TouchableOpacity 
              style={[styles.actionButton, { marginRight: 8, backgroundColor: 'rgba(242, 97, 30, 0.15)' }]}
              onPress={() => navigation.navigate('BroadcastMessage', { eventId: item.id, eventTitle: item.title })}
            >
              <Send size={16} color="#f2611e" />
              <Text style={[styles.actionButtonText, { color: '#f2611e' }]}>Broadcast</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditEvent', { eventId: item.id })}
          >
            <Edit size={16} color="#f4f2f0" />
            <Text style={styles.actionButtonText}>Edit Event</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#f2611e" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 120 + insets.bottom }]}
          ListEmptyComponent={
            <Text style={styles.emptyText}>You haven't created any events yet.</Text>
          }
        />
      )}

      <TouchableOpacity 
        style={[styles.fab, { bottom: 100 + insets.bottom }]}
        onPress={() => navigation.navigate('CreateEvent')}
      >
        <Plus color="#fff" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
    paddingTop: 100,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  eventCard: {
    backgroundColor: '#2c2a28',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    color: '#f4f2f0',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPub: { backgroundColor: 'rgba(40, 167, 69, 0.2)' },
  statusDraft: { backgroundColor: 'rgba(255, 193, 7, 0.2)' },
  statusText: { color: '#f4f2f0', fontSize: 12, fontWeight: 'bold' },
  eventDate: {
    color: '#8e8b85',
    marginBottom: 16,
  },
  statsContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statText: {
    color: '#c2bdb8',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#f4f2f0',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#8e8b85',
    textAlign: 'center',
    marginTop: 40,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f2611e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f2611e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  }
});
