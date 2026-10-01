import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Linking, TouchableOpacity } from 'react-native';
import { supabase } from '../../supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminJobAppsScreen() {
  const insets = useSafeAreaInsets();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      console.log('Error fetching job apps', err);
    } finally {
      setLoading(false);
    }
  };

  const openResume = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.role}>{item.role_applied_for}</Text>
      <Text style={styles.name}>{item.full_name}</Text>
      <Text style={styles.text}>{item.email} • {item.phone_number}</Text>
      <Text style={styles.text}>{item.cover_letter}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => openResume(item.resume_url)}>
        <Text style={styles.btnText}>View Resume</Text>
      </TouchableOpacity>
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
  role: { color: '#f2611e', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  name: { color: '#f4f2f0', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  text: { color: '#c2bdb8', marginBottom: 8 },
  btn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#f4f2f0', fontWeight: 'bold' },
  empty: { color: '#8e8b85', textAlign: 'center', marginTop: 40 },
});
