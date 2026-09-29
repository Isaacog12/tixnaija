import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase/client';
import { Share2 } from 'lucide-react-native';

export default function EventDetailScreen({ route, navigation }: any) {
  const { eventId, slug } = route.params || {};
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<any>(null);
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<{[key: string]: number}>({});
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState<string | null>(null);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId, slug]);

  const fetchEventDetails = async () => {
    try {
      let eventData;
      
      if (eventId) {
        const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (error) throw error;
        eventData = data;
      } else if (slug) {
        const { data, error } = await supabase.from('events').select('*').eq('slug', slug).single();
        if (error) throw error;
        eventData = data;
      } else {
        throw new Error('No event identifier provided');
      }

      const ticketsRes = await supabase.from('ticket_types').select('*').eq('event_id', eventData.id).order('price_kobo', { ascending: true });
      if (ticketsRes.error) throw ticketsRes.error;

      setEvent(eventData);
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

  const handleJoinWaitlist = async (ticketTypeId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      Alert.alert("Sign In Required", "You must create an account or sign in to join the waitlist.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => navigation.navigate("Login") }
      ]);
      return;
    }

    setIsJoiningWaitlist(ticketTypeId);
    try {
      const { error } = await (supabase
        .from('waitlist_entries' as any)
        .insert([{
          event_id: event.id,
          ticket_type_id: ticketTypeId,
          user_id: session.user.id
        }]) as any);
        
      if (error) {
        if (error.code === '23505') throw new Error('You are already on the waitlist for this ticket.');
        throw error;
      }
      
      Alert.alert('Success', "You've been added to the waitlist! We will notify you if a spot opens up.");
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not join waitlist.');
    } finally {
      setIsJoiningWaitlist(null);
    }
  };

  const handleCheckout = async () => {
    if (totalTickets === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      Alert.alert("Sign In Required", "You must create an account or sign in to buy tickets.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => navigation.navigate("Login") }
      ]);
      return;
    }

    let totalAmount = 0;
    const ticketsPayload = Object.entries(selectedTickets)
      .filter(([_, count]) => count > 0)
      .map(([ticketTypeId, count]) => {
         const tt = ticketTypes.find(t => t.id === ticketTypeId);
         if (tt) totalAmount += (tt.price_kobo * count);
         return { ticketTypeId, count };
      });

    navigation.navigate('Checkout', {
      eventId: event.id,
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

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${event.title} on TixNaija!\n\nGet your tickets here: https://tixnaija.name.ng/e/${event.slug}`,
        title: event.title,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.title}</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Share2 color="#f4f2f0" size={24} />
          </TouchableOpacity>
        </View>
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
              {ticket.quantity_available === 0 ? (
                <TouchableOpacity 
                  style={styles.waitlistBtn} 
                  onPress={() => handleJoinWaitlist(ticket.id)}
                  disabled={isJoiningWaitlist === ticket.id}
                >
                  {isJoiningWaitlist === ticket.id ? (
                    <ActivityIndicator size="small" color="#22201e" />
                  ) : (
                    <Text style={styles.waitlistBtnText}>Join Waitlist</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => updateTicketCount(ticket.id, -1)}>
                    <Text style={styles.actionBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.ticketCount}>{selectedTickets[ticket.id] || 0}</Text>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => updateTicketCount(ticket.id, 1)}>
                    <Text style={styles.actionBtnText}>+</Text>
                  </TouchableOpacity>
                </>
              )}
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f4f2f0',
    letterSpacing: -0.5,
    flex: 1,
    marginRight: 16,
  },
  shareBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
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
  waitlistBtn: {
    backgroundColor: '#ffd60a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitlistBtnText: {
    color: '#22201e',
    fontSize: 14,
    fontWeight: '700',
  },
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
