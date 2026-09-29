import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../supabase/client';
import { Search } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MyTicketsScreen({ navigation }: any) {
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'valid', 'scanned'

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    try {
      // 1. Try to load from cache first (Offline support)
      const cachedTickets = await AsyncStorage.getItem('@my_tickets_cache');
      if (cachedTickets) {
        setAllTickets(JSON.parse(cachedTickets));
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      // 2. Fetch fresh from network
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          events (
            id,
            title,
            start_datetime,
            venue_name
          ),
          order_items (
            ticket_types (name),
            tickets (
              id,
              status,
              attendee_name,
              qr_code_data
            )
          )
        `)
        .or(`user_id.eq.${session.user.id},buyer_email.eq.${session.user.email}`);

      if (error) throw error;

      let extractedTickets: any[] = [];
      data?.forEach((order: any) => {
         const event = order.events;
         order.order_items?.forEach((item: any) => {
            const ticketType = item.ticket_types;
            item.tickets?.forEach((ticket: any) => {
               extractedTickets.push({
                  ...ticket,
                  event,
                  ticketType,
                  orderId: order.id
               });
            });
         });
      });

      // Sort by event date descending
      extractedTickets.sort((a, b) => new Date(b.event.start_datetime).getTime() - new Date(a.event.start_datetime).getTime());
      
      // Update state and cache
      setAllTickets(extractedTickets);
      await AsyncStorage.setItem('@my_tickets_cache', JSON.stringify(extractedTickets));

    } catch (error: any) {
      console.error('Error fetching tickets:', error.message);
      // We don't clear the cache on network error, so users can still see offline tickets
    } finally {
      setLoading(false);
    }
  };

  const renderTicket = ({ item }: { item: any }) => {
    const { event, ticketType } = item;
    if (!event) return null;

    const qrData = item.qr_code_data || item.id;

    return (
      <View style={styles.ticketCard}>
        <View style={styles.ticketHeader}>
          <Text style={styles.eventName}>{event.title}</Text>
          <Text style={styles.eventDate}>
            {new Date(event.start_datetime).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.ticketBody}>
          <View style={styles.qrContainer}>
            <QRCode
              value={qrData}
              size={150}
              color="#22201e"
              backgroundColor="#f4f2f0"
            />
          </View>
          <View style={styles.ticketDetails}>
            <Text style={styles.detailLabel}>Attendee</Text>
            <Text style={styles.detailValue}>{item.attendee_name || 'Guest'}</Text>

            <Text style={[styles.detailLabel, { marginTop: 12 }]}>Type</Text>
            <Text style={styles.detailValue}>{ticketType?.name || 'General Admission'}</Text>

            <Text style={[styles.detailLabel, { marginTop: 12 }]}>Status</Text>
            <Text style={[
              styles.detailValue,
              { color: item.status === 'valid' ? '#10b981' : '#f2611e' }
            ]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const filteredTickets = allTickets.filter(ticket => {
    const matchesSearch = ticket.event?.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (ticket.attendee_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && ticket.status === filterStatus;
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color="#767069" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tickets or events..."
            placeholderTextColor="#767069"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterText, filterStatus === 'all' && styles.filterTextActive]}>All Tickets</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filterStatus === 'valid' && styles.filterChipActive]}
            onPress={() => setFilterStatus('valid')}
          >
            <Text style={[styles.filterText, filterStatus === 'valid' && styles.filterTextActive]}>Valid</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filterStatus === 'scanned' && styles.filterChipActive]}
            onPress={() => setFilterStatus('scanned')}
          >
            <Text style={[styles.filterText, filterStatus === 'scanned' && styles.filterTextActive]}>Scanned / Used</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredTickets}
        keyExtractor={(item) => item.id}
        renderItem={renderTicket}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
             {searchQuery ? "No tickets found matching your search." : "You haven't purchased any tickets yet."}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#22201e', paddingTop: 100 },
  centerContainer: { flex: 1, backgroundColor: '#22201e', justifyContent: 'center', alignItems: 'center' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#f4f2f0',
    fontSize: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(242, 97, 30, 0.2)',
    borderColor: '#f2611e',
  },
  filterText: {
    color: '#c2bdb8',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#f2611e',
    fontWeight: 'bold',
  },
  listContent: { padding: 16, paddingBottom: 40 },
  ticketCard: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  ticketHeader: {
    padding: 16,
    backgroundColor: 'rgba(242, 97, 30, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  eventName: { fontSize: 20, fontWeight: 'bold', color: '#f4f2f0', marginBottom: 4 },
  eventDate: { fontSize: 14, color: '#f2611e' },
  ticketBody: {
    padding: 24,
    alignItems: 'center',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#f4f2f0',
    borderRadius: 12,
    marginBottom: 24,
  },
  ticketDetails: {
    width: '100%',
    alignItems: 'center',
  },
  detailLabel: { fontSize: 12, color: '#767069', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  detailValue: { fontSize: 16, color: '#f4f2f0', fontWeight: 'bold', textAlign: 'center' },
  emptyText: { color: '#c2bdb8', textAlign: 'center', marginTop: 32 },
});
