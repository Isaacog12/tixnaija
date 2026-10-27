import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
} from 'lucide-react-native';

import { useAuth } from '../../../src/context/AuthContext';
import { supabase } from '../../../src/supabase/client';
import { colors } from '../../../src/theme/colors';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { LoadingState } from '../../../src/components/LoadingState';

const CATEGORIES = [
  'music',
  'comedy',
  'conference',
  'church',
  'campus',
  'party',
  'sport',
  'other',
] as const;

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('music');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [newCoverBase64, setNewCoverBase64] = useState<string | null>(null);

  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'completed' | 'cancelled'>('published');

  // Load Event
  useEffect(() => {
    if (!id) return;

    const loadEvent = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          setTitle(data.title);
          setDescription(data.description || '');
          setCategory(data.category as any);
          setCoverImageUrl(data.cover_image_url);
          setVenueName(data.venue_name || '');
          setAddress(data.address || '');
          setCity(data.city || 'Lagos');
          setState(data.state || 'Lagos State');
          setStartDateTime(new Date(data.start_datetime).toISOString().slice(0, 16));
          setEndDateTime(new Date(data.end_datetime).toISOString().slice(0, 16));
          setStatus(data.status);
        }
      } catch (err: any) {
        Alert.alert('Load Error', err.message || 'Could not load event details.');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    loadEvent();
  }, [id]);

  const handlePickCover = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setCoverImageUrl(result.assets[0].uri);
        setNewCoverBase64(result.assets[0].base64 || null);
      }
    } catch (err: any) {
      Alert.alert('Image Picker Error', err.message || 'Could not select photo');
    }
  };

  const handleSave = async () => {
    if (!id || !user) return;
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Event title cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalCoverUrl = coverImageUrl;

      if (newCoverBase64) {
        const fileExt = coverImageUrl?.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}/${Date.now()}_cover.${fileExt}`;

        const binaryString = atob(newCoverBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const { error: uploadError } = await supabase.storage
          .from('event-covers')
          .upload(fileName, bytes.buffer, {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('event-covers')
            .getPublicUrl(fileName);
          finalCoverUrl = publicUrlData.publicUrl;
        }
      }

      const { error } = await supabase
        .from('events')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          category,
          venue_name: venueName.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          start_datetime: new Date(startDateTime).toISOString(),
          end_datetime: new Date(endDateTime).toISOString(),
          cover_image_url: finalCoverUrl,
          status,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Saved', 'Event updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEvent = () => {
    Alert.alert(
      'Cancel Event',
      'Are you sure you want to cancel this event? Attendees with tickets will be notified and ticket sales will immediately halt.',
      [
        { text: 'Keep Event', style: 'cancel' },
        {
          text: 'Yes, Cancel Event',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const { error } = await supabase
                .from('events')
                .update({
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString(),
                } as any)
                .eq('id', id);

              if (error) throw error;
              setStatus('cancelled');
              Alert.alert('Cancelled', 'This event has been marked as cancelled.');
            } catch (err: any) {
              Alert.alert('Cancel Error', err.message || 'Failed to cancel event.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return <LoadingState message="Loading event details..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Event</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Photo */}
        <TouchableOpacity
          style={styles.coverUploadBox}
          onPress={handlePickCover}
          activeOpacity={0.8}
        >
          {coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} style={styles.coverPreview} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Camera size={32} color={colors.primary} style={{ marginBottom: 8 }} />
              <Text style={styles.uploadTitle}>Change Event Flyer</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Basic Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Event Details</Text>

          <Input
            label="Event Title"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[styles.categoryText, isSelected && styles.categoryTextSelected]}
                  >
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Input
            label="Description"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        {/* Date and Time */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Schedule</Text>

          <Input
            label="Starts"
            value={startDateTime}
            onChangeText={setStartDateTime}
          />

          <Input
            label="Ends"
            value={endDateTime}
            onChangeText={setEndDateTime}
          />
        </View>

        {/* Venue */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Location</Text>

          <Input
            label="Venue Name"
            value={venueName}
            onChangeText={setVenueName}
          />

          <Input
            label="Street Address"
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.twoColumn}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="City"
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Input
                label="State"
                value={state}
                onChangeText={setState}
              />
            </View>
          </View>
        </View>

        {/* Status Selection */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Publication Status</Text>
          <View style={styles.statusButtonsRow}>
            {(['published', 'draft', 'completed'] as const).map((s) => {
              const isSelected = status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusBtn, isSelected && styles.statusBtnSelected]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[styles.statusBtnText, isSelected && styles.statusBtnTextSelected]}>
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.submitSection}>
          <Button
            title="Save Changes"
            variant="primary"
            loading={isSubmitting}
            onPress={handleSave}
            style={{ marginBottom: 12 }}
          />

          {status !== 'cancelled' && (
            <TouchableOpacity
              style={styles.cancelEventBtn}
              onPress={handleCancelEvent}
              activeOpacity={0.7}
            >
              <AlertTriangle size={16} color={colors.error} style={{ marginRight: 6 }} />
              <Text style={styles.cancelEventBtnText}>Cancel Event</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  coverUploadBox: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  coverPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  sectionHeader: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  categoryText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  twoColumn: {
    flexDirection: 'row',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statusBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  statusBtnText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  statusBtnTextSelected: {
    color: '#fff',
  },
  submitSection: {
    marginTop: 8,
  },
  cancelEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelEventBtnText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
});
