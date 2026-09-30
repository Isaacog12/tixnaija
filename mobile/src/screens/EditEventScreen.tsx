import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Platform, KeyboardAvoidingView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase/client';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Camera, Calendar, Image as ImageIcon } from 'lucide-react-native';

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
  const [status, setStatus] = useState<'draft' | 'published' | 'cancelled' | 'completed'>('draft');

  // Image handling
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Date times
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

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
          setStatus(data.status || 'draft');
          
          if (data.cover_image_url) {
            setExistingImageUrl(data.cover_image_url);
          }
          if (data.start_datetime) {
            setStartDate(new Date(data.start_datetime));
          }
          if (data.end_datetime) {
            setEndDate(new Date(data.end_datetime));
          }
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

  const handleUpdate = async () => {
    if (!title || !venueName || !city) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = existingImageUrl;
      
      if (imageUri) {
        finalImageUrl = await uploadImage(imageUri);
      }

      const { error } = await supabase
        .from('events')
        .update({
          title,
          description,
          venue_name: venueName,
          city,
          start_datetime: startDate.toISOString(),
          end_datetime: endDate.toISOString(),
          cover_image_url: finalImageUrl,
          status,
        })
        .eq('id', eventId);

      if (error) throw error;
      Alert.alert('Success', 'Event updated successfully!');
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.header}>Edit Event</Text>
        <TouchableOpacity style={styles.statusToggle} onPress={toggleStatus}>
          <Text style={styles.statusToggleText}>
            {status === 'published' ? 'Unpublish' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { marginBottom: 20 }]}>Current Status: <Text style={{ color: status === 'published' ? '#2ED573' : '#f2611e' }}>{status.toUpperCase()}</Text></Text>

      {/* Cover Image */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {imageUri || existingImageUrl ? (
          <Image source={{ uri: imageUri || existingImageUrl! }} style={styles.coverImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <ImageIcon color="#8e8b85" size={32} />
            <Text style={styles.imagePlaceholderText}>Upload Cover Image</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>Venue Name</Text>
      <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholderTextColor="#8e8b85" />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor="#8e8b85" />

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

      <TouchableOpacity style={styles.button} onPress={handleUpdate} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
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
  center: {
    flex: 1,
    backgroundColor: '#22201e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f4f2f0',
    letterSpacing: -0.5,
  },
  statusToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  statusToggleText: {
    color: '#f2611e',
    fontWeight: '700',
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
