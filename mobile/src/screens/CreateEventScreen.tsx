import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase/client';
export default function CreateEventScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'music' | 'comedy' | 'conference' | 'church' | 'campus' | 'party' | 'sport' | 'other'>('music');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [startDatetime, setStartDatetime] = useState(''); // e.g. 2026-12-01T19:00:00
  const [endDatetime, setEndDatetime] = useState('');

  const [ticketName, setTicketName] = useState('Regular');
  const [ticketPrice, setTicketPrice] = useState('5000');
  const [ticketQty, setTicketQty] = useState('100');

  const handleCreate = async () => {
    if (!title || !startDatetime || !endDatetime || !venueName || !city) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);

      // 1. Insert Event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          title,
          slug,
          description,
          category,
          venue_name: venueName,
          city,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          organizer_id: user.id,
          status: 'draft', // Create as draft first
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // 2. Insert Ticket
      const { error: ticketError } = await supabase
        .from('ticket_types')
        .insert({
          event_id: event.id,
          name: ticketName,
          price_kobo: parseInt(ticketPrice, 10) * 100,
          quantity_available: parseInt(ticketQty, 10),
          max_per_order: 10,
        });

      if (ticketError) throw ticketError;

      Alert.alert('Success', 'Event created successfully!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Create Event</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event Title" placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Description" multiline placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Venue Name</Text>
      <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholder="Venue" placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Start Date & Time (YYYY-MM-DDTHH:MM)</Text>
      <TextInput style={styles.input} value={startDatetime} onChangeText={setStartDatetime} placeholder="2026-10-31T18:00" placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>End Date & Time</Text>
      <TextInput style={styles.input} value={endDatetime} onChangeText={setEndDatetime} placeholder="2026-10-31T23:00" placeholderTextColor="#8e8b85" />

      <Text style={styles.sectionHeader}>Ticket Details</Text>
      <Text style={styles.label}>Ticket Name</Text>
      <TextInput style={styles.input} value={ticketName} onChangeText={setTicketName} placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Price (Naira)</Text>
      <TextInput style={styles.input} value={ticketPrice} onChangeText={setTicketPrice} keyboardType="numeric" placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Quantity Available</Text>
      <TextInput style={styles.input} value={ticketQty} onChangeText={setTicketQty} keyboardType="numeric" placeholderTextColor="#8e8b85" />

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save as Draft</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
    paddingTop: 100,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f2611e',
    marginTop: 20,
    marginBottom: 10,
  },
  label: {
    color: '#c2bdb8',
    marginBottom: 8,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#2c2a28',
    color: '#f4f2f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#f2611e',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
