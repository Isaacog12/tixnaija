import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase/client';

export default function EditEventScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { eventId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'cancelled' | 'completed'>('draft');

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (error) throw error;
        if (data) {
          setTitle(data.title || '');
          setDescription(data.description || '');
          setVenueName(data.venue_name || '');
          setCity(data.city || '');
          setStartDatetime(data.start_datetime || '');
          setEndDatetime(data.end_datetime || '');
          setStatus(data.status || 'draft');
        }
      } catch (err: any) {
        Alert.alert('Error', err.message);
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          title,
          description,
          venue_name: venueName,
          city,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          status,
        })
        .eq('id', eventId);

      if (error) throw error;
      Alert.alert('Success', 'Event updated!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = () => {
    setStatus(status === 'published' ? 'draft' : 'published');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Edit Event</Text>
        <TouchableOpacity style={styles.statusToggle} onPress={toggleStatus}>
          <Text style={styles.statusToggleText}>
            {status === 'published' ? 'Unpublish' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Current Status: {status}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Venue Name</Text>
      <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Start Date & Time</Text>
      <TextInput style={styles.input} value={startDatetime} onChangeText={setStartDatetime} placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>End Date & Time</Text>
      <TextInput style={styles.input} value={endDatetime} onChangeText={setEndDatetime} placeholderTextColor="#8e8b85" />

      <TouchableOpacity style={styles.button} onPress={handleUpdate} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#22201e', paddingTop: 100 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#22201e', justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#f4f2f0' },
  statusToggle: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
  statusToggleText: { color: '#f2611e', fontWeight: 'bold' },
  label: { color: '#c2bdb8', marginBottom: 8, fontSize: 14 },
  input: {
    backgroundColor: '#2c2a28', color: '#f4f2f0', borderRadius: 8,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  button: { backgroundColor: '#f2611e', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
