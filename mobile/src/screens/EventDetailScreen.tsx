import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase/client';

export default function EventDetailScreen({ route, navigation }: any) {
  const { eventId } = route.params;
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<any>(null);
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<{[key: string]: number}>({});

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      const [eventRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('ticket_types').select('*').eq('event_id', eventId).order('price_kobo', { ascending: true })
      ]);

      if (eventRes.error) throw eventRes.error;
      if (ticketsRes.error) throw ticketsRes.error;

      setEvent(eventRes.data);
      setTicketTypes(ticketsRes.data || []);
    } catch (error) {
      console.error('Error fetching event details:', error);
      Alert.alert('Error', 'Could not load event details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateTicketCount = (ticketId: string, delta: number) => {
    setSelectedTickets(prev => {
      const current = prev[ticketId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [ticketId]: next };
    });
  };

  const totalTickets = Object.values(selectedTickets).reduce((a, b) => a + b, 0);

  const handleCheckout = () => {
    if (totalTickets === 0) return;

    let totalAmount = 0;
    const ticketsPayload = Object.entries(selectedTickets)
      .filter(([_, count]) => count > 0)
      .map(([ticketTypeId, count]) => {
         const tt = ticketTypes.find(t => t.id === ticketTypeId);
         if (tt) totalAmount += (tt.price_kobo * count);
         return { ticketTypeId, count };
      });

    navigation.navigate('Checkout', {
      eventId,
      tickets: ticketsPayload,
      totalAmount
    });
  };

  if (loading || !event) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.description}>{event.description}</Text>
        
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>Date & Time</Text>
          <Text style={styles.metaText}>{new Date(event.start_datetime).toLocaleString()}</Text>
          
          <Text style={[styles.metaLabel, { marginTop: 12 }]}>Location</Text>
          <Text style={styles.metaText}>
            {event.venue_name ? event.venue_name : 'Online'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Tickets</Text>
        {ticketTypes.map(ticket => (
          <View key={ticket.id} style={styles.ticketCard}>
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketName}>{ticket.name}</Text>
              <Text style={styles.ticketPrice}>
                {ticket.price_kobo === 0 ? 'Free' : `₦${(ticket.price_kobo / 100).toLocaleString()}`}
              </Text>
            </View>
            <View style={styles.ticketActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => updateTicketCount(ticket.id, -1)}>
                <Text style={styles.actionBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.ticketCount}>{selectedTickets[ticket.id] || 0}</Text>
              <TouchableOpacity style={styles.actionBtn} onPress={() => updateTicketCount(ticket.id, 1)}>
                <Text style={styles.actionBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {totalTickets > 0 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
            <Text style={styles.checkoutBtnText}>Checkout ({totalTickets} ticket{totalTickets > 1 ? 's' : ''})</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#22201e', paddingTop: 100 },
  centerContainer: { flex: 1, backgroundColor: '#22201e', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#f4f2f0', marginBottom: 12 },
  description: { fontSize: 16, color: '#c2bdb8', marginBottom: 24, lineHeight: 24 },
  metaBox: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 32,
  },
  metaLabel: { fontSize: 12, color: '#767069', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  metaText: { fontSize: 16, color: '#f4f2f0', fontWeight: '500' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#f4f2f0', marginBottom: 16 },
  ticketCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 12,
  },
  ticketInfo: { flex: 1 },
  ticketName: { fontSize: 16, fontWeight: '600', color: '#f4f2f0', marginBottom: 4 },
  ticketPrice: { fontSize: 14, color: '#f2611e', fontWeight: '500' },
  ticketActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#403b38',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { color: '#f4f2f0', fontSize: 18, fontWeight: 'bold' },
  ticketCount: { color: '#f4f2f0', fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#22201e',
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  checkoutBtn: {
    backgroundColor: '#f2611e',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutBtnText: { color: '#22201e', fontSize: 16, fontWeight: 'bold' },
});
