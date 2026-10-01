import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';

export default function AdminOrganizerAppsScreen() {
  const insets = useSafeAreaInsets();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('organizer_applications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      console.log('Error fetching organizer apps', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (appId: string, userId: string) => {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_organizer: true, is_verified_organizer: true } as any)
        .eq('id', userId);
        
      if (profileError) throw profileError;

      const { error: appError } = await supabase
        .from('organizer_applications')
        .update({ status: 'approved' } as any)
        .eq('id', appId);

      if (appError) throw appError;

      Alert.alert('Success', 'Organizer approved');
      fetchApplications();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleReject = async (appId: string) => {
    try {
      const { error } = await supabase
        .from('organizer_applications')
        .update({ status: 'rejected' } as any)
        .eq('id', appId);
      if (error) throw error;
      Alert.alert('Success', 'Organizer rejected');
      fetchApplications();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.full_name}</Text>
        <Text style={[styles.status, item.status === 'approved' ? styles.statusApproved : item.status === 'rejected' ? styles.statusRejected : styles.statusPending]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.text}>{item.email} • {item.phone_number}</Text>
      <Text style={styles.text}>{item.experience_description}</Text>
      
      {item.status === 'pending' && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => handleApprove(item.id, item.user_id)}>
            <Check size={16} color="#fff" />
            <Text style={styles.btnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => handleReject(item.id)}>
            <X size={16} color="#fff" />
            <Text style={styles.btnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#f2611e" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={applications}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]}
          ListEmptyComponent={<Text style={styles.empty}>No applications found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#22201e', paddingTop: 100 },
  list: { padding: 16 },
  card: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { color: '#f4f2f0', fontSize: 18, fontWeight: 'bold' },
  status: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPending: { backgroundColor: 'rgba(255, 193, 7, 0.2)', color: '#ffc107' },
  statusApproved: { backgroundColor: 'rgba(40, 167, 69, 0.2)', color: '#28a745' },
  statusRejected: { backgroundColor: 'rgba(220, 53, 69, 0.2)', color: '#dc3545' },
  text: { color: '#c2bdb8', marginBottom: 8 },
  actions: { flexDirection: 'row', marginTop: 8, gap: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  approveBtn: { backgroundColor: '#28a745' },
  rejectBtn: { backgroundColor: '#dc3545' },
  btnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  empty: { color: '#8e8b85', textAlign: 'center', marginTop: 40 },
});
