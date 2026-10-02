import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Share, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase/client';
import { Share2, BadgeCheck, ChevronRight } from 'lucide-react-native';

export default function EventDetailScreen({ route, navigation }: any) {
  const { eventId, slug } = route.params || {};
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<any>(null);
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<{[key: string]: number}>({});
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState<string | null>(null);
  const [socialProof, setSocialProof] = useState<any>(null);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId, slug]);

  const fetchEventDetails = async () => {
    try {
      let eventData;
      
      if (eventId) {
        const { data, error } = await supabase.from('events').select('*, profiles(*)').eq('id', eventId).single();
        if (error) throw error;
        eventData = data;
      } else if (slug) {
        const { data, error } = await supabase.from('events').select('*, profiles(*)').eq('slug', slug).single();
        if (error) throw error;
        eventData = data;
      } else {
        throw new Error('No event identifier provided');
      }

      const ticketsRes = await supabase.from('ticket_types').select('*').eq('event_id', eventData.id).order('price_kobo', { ascending: true });
      if (ticketsRes.error) throw ticketsRes.error;

      // Fetch Social Proof
      const attendeesRes = await supabase.rpc('get_event_attendees' as any, { p_event_id: eventData.id });
      if (!attendeesRes.error && attendeesRes.data) {
        setSocialProof(attendeesRes.data);
      }

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
          ticket_tier_id: ticketTypeId,
          user_id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email
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

        {event.profiles && (
          <TouchableOpacity 
            style={styles.organizerBox}
            onPress={() => navigation.navigate('BoxOffice', { organizerId: event.profiles.id })}
          >
            <View style={styles.organizerRow}>
              <View style={styles.organizerAvatar}>
                <Text style={styles.organizerInitials}>{event.profiles.full_name?.charAt(0).toUpperCase() || 'O'}</Text>
              </View>
              <View style={styles.organizerInfo}>
                <Text style={styles.metaLabel}>Organized By</Text>
                <View style={styles.nameRow}>
                  <Text style={styles.organizerName}>{event.profiles.full_name}</Text>
                  {event.profiles.is_verified_organizer && (
                    <BadgeCheck size={16} color="#3b82f6" style={{ marginLeft: 4 }} />
                  )}
                </View>
              </View>
              <ChevronRight color="#767069" size={20} />
            </View>
          </TouchableOpacity>
        )}

        {/* Social Proof Box */}
        {socialProof && socialProof.total_count > 0 && (
          <View style={styles.socialProofBox}>
            <View style={styles.avatarsRow}>
              {socialProof.can_view_avatars && socialProof.attendees?.length > 0 ? (
                <>
                  <View style={styles.avatarStack}>
                    {socialProof.attendees.map((a: any, idx: number) => (
                      <View key={a.user_id} style={[styles.miniAvatar, { marginLeft: idx === 0 ? 0 : -12, zIndex: 10 - idx }]}>
                        {a.avatar_url ? (
                          <Image source={{ uri: a.avatar_url }} style={styles.miniAvatarImage} />
                        ) : (
                          <Text style={styles.miniAvatarText}>{a.first_name.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                  <Text style={styles.socialText}>
                    Joined by {socialProof.attendees.map((a:any)=>a.first_name).join(', ')} 
                    {socialProof.total_count > socialProof.attendees.length ? ` and ${socialProof.total_count - socialProof.attendees.length} others` : ''}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.avatarStack}>
                    <View style={[styles.miniAvatar, { backgroundColor: '#403b38' }]}><Text style={styles.miniAvatarText}>?</Text></View>
                    <View style={[styles.miniAvatar, { backgroundColor: '#403b38', marginLeft: -12 }]}><Text style={styles.miniAvatarText}>?</Text></View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.socialText, { marginBottom: 2 }]}>
                      {socialProof.total_count} {socialProof.total_count === 1 ? 'person is' : 'people are'} attending.
                    </Text>
                    {!socialProof.can_view_avatars && (
                      <Text style={styles.socialHintText}>Enable "Guest Lists" in Settings to see who!</Text>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

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
  organizerBox: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 32,
  },
  organizerRow: { flexDirection: 'row', alignItems: 'center' },
  organizerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#403b38', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  organizerInitials: { fontSize: 18, fontWeight: 'bold', color: '#f4f2f0' },
  organizerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  organizerName: { fontSize: 16, fontWeight: '600', color: '#f4f2f0' },
  
  socialProofBox: {
    backgroundColor: 'rgba(242, 97, 30, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 97, 30, 0.2)',
    marginBottom: 32,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: 12,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f2611e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#22201e',
    overflow: 'hidden',
  },
  miniAvatarImage: {
    width: '100%',
    height: '100%',
  },
  miniAvatarText: {
    color: '#22201e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  socialText: {
    flex: 1,
    fontSize: 14,
    color: '#f4f2f0',
    lineHeight: 20,
  },
  socialHintText: {
    fontSize: 12,
    color: '#f2611e',
    fontWeight: '500',
  },

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
