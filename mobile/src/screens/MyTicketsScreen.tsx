import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../supabase/client';

export default function MyTicketsScreen({ navigation }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          status,
          attendee_name,
          qr_code_data,
          order_items!inner(
            ticket_types(name),
            orders!inner(
              events!inner(
                id,
                title,
                start_datetime,
                venue_name
              )
            )
          )
        `);

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      console.error('Error fetching tickets:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTicket = ({ item }: { item: any }) => {
    const event = item.order_items?.orders?.events;
    const ticketType = item.order_items?.ticket_types;
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
        data={tickets}
        keyExtractor={(item) => item.id}
        renderItem={renderTicket}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>You haven't purchased any tickets yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#22201e' },
  centerContainer: { flex: 1, backgroundColor: '#22201e', justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
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
  detailValue: { fontSize: 16, color: '#f4f2f0', fontWeight: 'bold' },
  emptyText: { color: '#c2bdb8', textAlign: 'center', marginTop: 32 },
});
