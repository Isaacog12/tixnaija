import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminBannersScreen() {
  const insets = useSafeAreaInsets();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners' as any)
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      setBanners(data || []);
    } catch (err: any) {
      console.log('Error fetching banners', err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.image} />
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.link} numberOfLines={1}>{item.link_url}</Text>
        <Text style={[styles.status, item.is_active ? styles.active : styles.inactive]}>
          {item.is_active ? 'ACTIVE' : 'INACTIVE'} (Order: {item.display_order})
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#f2611e" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={banners}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]}
          ListEmptyComponent={<Text style={styles.empty}>No banners found.</Text>}
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden'
  },
  image: { width: '100%', height: 160 },
  placeholder: { width: '100%', height: 160, backgroundColor: '#403b38' },
  content: { padding: 16 },
  title: { color: '#f4f2f0', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  link: { color: '#8e8b85', fontSize: 14, marginBottom: 8 },
  status: { fontSize: 12, fontWeight: 'bold' },
  active: { color: '#28a745' },
  inactive: { color: '#dc3545' },
  empty: { color: '#8e8b85', textAlign: 'center', marginTop: 40 },
});
