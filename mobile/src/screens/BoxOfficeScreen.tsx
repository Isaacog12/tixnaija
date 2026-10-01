import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image } from 'react-native';
import { supabase } from '../../supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, Calendar, MapPin } from 'lucide-react-native';

export default function BoxOfficeScreen({ route, navigation }: any) {
  const { organizerId, organizerSlug } = route.params || {};
  const [profile, setProfile] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchData();
  }, [organizerId, organizerSlug]);

  const fetchData = async () => {
    try {
      let query = supabase.from('profiles').select('*');
      if (organizerId) {
        query = query.eq('id', organizerId);
      } else if (organizerSlug) {
        query = query.eq('organizer_slug' as any, organizerSlug);
      }
      
      const { data: prof, error: profErr } = await query.single();
      if (profErr || !prof) throw profErr || new Error('Organizer not found');

      setProfile(prof);

      const { data: evts, error: evtErr } = await supabase
        .from('events')
        .select('*, ticket_types(price_kobo)')
        .eq('organizer_id', prof.id)
        .eq('status', 'published')
        .order('start_datetime', { ascending: true });
      
      if (evtErr) throw evtErr;
      
      // Sort so upcoming are first, past are later
      const upcoming = evts.filter((e: any) => new Date(e.start_datetime) >= new Date());
      const past = evts.filter((e: any) => new Date(e.start_datetime) < new Date());
      
      setEvents([...upcoming, ...past]);
    } catch (e) {
      console.error(e);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  const renderEvent = ({ item }: { item: any }) => {
    const isPast = new Date(item.start_datetime) < new Date();
    
    return (
      <TouchableOpacity 
        style={[styles.card, isPast && { opacity: 0.5 }]} 
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      >
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#403b38' }]} />
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardCategory}>{item.category || 'EVENT'}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.cardRow}>
            <Calendar size={14} color="#767069" />
            <Text style={styles.cardMetaText}>{new Date(item.start_datetime).toLocaleDateString()}</Text>
          </View>
          <View style={styles.cardRow}>
            <MapPin size={14} color="#767069" />
            <Text style={styles.cardMetaText}>{item.city || item.venue_name || 'TBA'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Header = () => (
    <View style={styles.header}>
      {profile.banner_url ? (
        <Image source={{ uri: profile.banner_url }} style={styles.banner} />
      ) : (
        <View style={[styles.banner, { backgroundColor: '#403b38' }]} />
      )}
      <View style={styles.avatarContainer}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{profile.full_name?.charAt(0).toUpperCase() || 'O'}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.is_verified_organizer && (
            <BadgeCheck size={20} color="#3b82f6" style={{ marginLeft: 8 }} />
          )}
        </View>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>
      <Text style={styles.sectionTitle}>Events</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        renderItem={renderEvent}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
        ListEmptyComponent={<Text style={styles.emptyText}>No events found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#22201e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#22201e' },
  header: { paddingBottom: 16 },
  banner: { width: '100%', height: 160 },
  avatarContainer: {
    marginTop: -40,
    marginLeft: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#22201e',
    backgroundColor: '#403b38',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 32, fontWeight: 'bold', color: '#f4f2f0' },
  info: { padding: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#f4f2f0' },
  bio: { fontSize: 16, color: '#c2bdb8', marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#f4f2f0', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  emptyText: { color: '#767069', marginHorizontal: 16, marginTop: 16 },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  cardImage: { width: '100%', height: 160 },
  cardContent: { padding: 12 },
  cardCategory: { color: '#f2611e', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  cardTitle: { color: '#f4f2f0', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardMetaText: { color: '#c2bdb8', fontSize: 14, marginLeft: 6 },
});
