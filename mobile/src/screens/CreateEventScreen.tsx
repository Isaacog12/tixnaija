import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Platform, KeyboardAvoidingView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase/client';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Camera, Calendar, MapPin, Plus, Trash2 } from 'lucide-react-native';

type TicketType = {
  name: string;
  price: string;
  qty: string;
};

export default function CreateEventScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  // Event Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'music' | 'comedy' | 'conference' | 'church' | 'campus' | 'party' | 'sport' | 'other'>('music');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Customization
  const [customSlug, setCustomSlug] = useState('');
  const [themeColor, setThemeColor] = useState('');
  const [customOrderConfirmation, setCustomOrderConfirmation] = useState('');
  const [tags, setTags] = useState('');

  // Date Times
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<TicketType[]>([{ name: 'Regular', price: '5000', qty: '100' }]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    const fileName = `mobile-upload-${Date.now()}.jpg`;
    
    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const { data, error } = await supabase.storage
      .from('event-covers')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
      });

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('event-covers')
      .getPublicUrl(fileName);
      
    return publicUrl;
  };

  const addTicket = () => {
    setTickets([...tickets, { name: '', price: '', qty: '' }]);
  };

  const updateTicket = (index: number, field: keyof TicketType, value: string) => {
    const newTickets = [...tickets];
    newTickets[index][field] = value;
    setTickets(newTickets);
  };

  const removeTicket = (index: number) => {
    if (tickets.length === 1) return;
    setTickets(tickets.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title || !venueName || !city) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    
    // Validate tickets
    for (const t of tickets) {
      if (!t.name || !t.price || !t.qty) {
        Alert.alert('Error', 'Please fill out all ticket fields');
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let uploadedImageUrl = null;
      if (imageUri) {
        uploadedImageUrl = await uploadImage(imageUri);
      }

      const slug = customSlug.trim() || (title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000));

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
          cover_image_url: uploadedImageUrl,
          start_datetime: startDate.toISOString(),
          end_datetime: endDate.toISOString(),
          organizer_id: user.id,
          status: 'draft', // Create as draft first
          theme_color: themeColor || null,
          custom_order_confirmation: customOrderConfirmation || null,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        } as any)
        .select()
        .single();

      if (eventError) throw eventError;

      // 2. Insert Tickets
      const ticketInserts = tickets.map(t => ({
        event_id: event.id,
        name: t.name,
        price_kobo: parseInt(t.price, 10) * 100,
        quantity_available: parseInt(t.qty, 10),
        max_per_order: 10,
      }));

      const { error: ticketError } = await supabase
        .from('ticket_types')
        .insert(ticketInserts);

      if (ticketError) throw ticketError;

      Alert.alert('Success', 'Event created successfully as a draft!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Create Event</Text>

      {/* Cover Image */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.coverImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Camera color="#8e8b85" size={32} />
            <Text style={styles.imagePlaceholderText}>Upload Cover Image</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event Title" placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Description" multiline placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Venue Name</Text>
      <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholder="Venue (or 'Online')" placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#8e8b85" />

      {/* Date Timers */}
      <View style={styles.dateRow}>
        <View style={styles.dateInputWrapper}>
          <Text style={styles.label}>Starts</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowStart(true)}>
            <Calendar color="#f2611e" size={16} />
            <Text style={styles.datePickerText}>
              {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateInputWrapper}>
          <Text style={styles.label}>Ends</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEnd(true)}>
            <Calendar color="#f2611e" size={16} />
            <Text style={styles.datePickerText}>
              {endDate.toLocaleDateString()} {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showStart && (
        <DateTimePicker
          value={startDate}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowStart(Platform.OS === 'ios');
            if (selectedDate) setStartDate(selectedDate);
          }}
        />
      )}
      
      {showEnd && (
        <DateTimePicker
          value={endDate}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowEnd(Platform.OS === 'ios');
            if (selectedDate) setEndDate(selectedDate);
          }}
        />
      )}

      {/* Tickets Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Tickets</Text>
        <TouchableOpacity style={styles.addTicketBtn} onPress={addTicket}>
          <Plus color="#f2611e" size={16} />
          <Text style={styles.addTicketText}>Add Ticket</Text>
        </TouchableOpacity>
      </View>

      {tickets.map((ticket, index) => (
        <View key={index} style={styles.ticketCard}>
          <View style={styles.ticketCardHeader}>
            <Text style={styles.ticketCount}>Ticket {index + 1}</Text>
            {tickets.length > 1 && (
              <TouchableOpacity onPress={() => removeTicket(index)}>
                <Trash2 color="#e55a5a" size={16} />
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.label}>Ticket Name</Text>
          <TextInput 
            style={styles.input} 
            value={ticket.name} 
            onChangeText={(v) => updateTicket(index, 'name', v)} 
            placeholder="e.g. VIP, Regular" 
            placeholderTextColor="#8e8b85" 
          />
          
          <View style={styles.ticketRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Price (NGN)</Text>
              <TextInput 
                style={styles.input} 
                value={ticket.price} 
                onChangeText={(v) => updateTicket(index, 'price', v)} 
                keyboardType="numeric" 
                placeholderTextColor="#8e8b85" 
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput 
                style={styles.input} 
                value={ticket.qty} 
                onChangeText={(v) => updateTicket(index, 'qty', v)} 
                keyboardType="numeric" 
                placeholderTextColor="#8e8b85" 
              />
            </View>
          </View>
        </View>
      ))}

      <View style={styles.customizationSection}>
        <Text style={styles.sectionTitle}>Event Customization</Text>
        
        <Text style={styles.label}>Event URL (Slug)</Text>
        <TextInput style={styles.input} value={customSlug} onChangeText={setCustomSlug} placeholder="Leave blank to auto-generate" placeholderTextColor="#8e8b85" autoCapitalize="none" />

        <Text style={styles.label}>Theme Color (Hex)</Text>
        <TextInput style={styles.input} value={themeColor} onChangeText={setThemeColor} placeholder="#ff6b00" placeholderTextColor="#8e8b85" autoCapitalize="none" />

        <Text style={styles.label}>Custom Order Confirmation Message</Text>
        <TextInput style={[styles.input, styles.textArea]} value={customOrderConfirmation} onChangeText={setCustomOrderConfirmation} multiline placeholderTextColor="#8e8b85" />

        <Text style={styles.label}>Tags (Comma separated)</Text>
        <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="e.g. Afrobeats, Tech" placeholderTextColor="#8e8b85" />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save as Draft</Text>}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
  },
  content: {
    padding: 20,
    paddingTop: 100,
    paddingBottom: 60,
  },
  customizationSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f4f2f0',
    marginBottom: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f4f2f0',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  imagePicker: {
    width: '100%',
    height: 180,
    backgroundColor: '#2c2a28',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#8e8b85',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    color: '#a39e99',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1a1917',
    color: '#f4f2f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateInputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1917',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  datePickerText: {
    color: '#f4f2f0',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f2f0',
    letterSpacing: -0.5,
  },
  addTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 97, 30, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addTicketText: {
    color: '#f2611e',
    marginLeft: 4,
    fontWeight: '600',
    fontSize: 13,
  },
  ticketCard: {
    backgroundColor: '#2c2a28',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ticketCount: {
    color: '#f4f2f0',
    fontWeight: '700',
    fontSize: 16,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#f2611e',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#22201e',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
