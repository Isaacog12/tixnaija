import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Tag,
  DollarSign,
  FileText,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Header } from '../../src/components/Header';

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

interface TicketTierInput {
  id: string;
  name: string;
  priceNaira: string;
  capacity: string;
}

interface CustomQuestionInput {
  id: string;
  question_text: string;
  type: 'text' | 'long_text' | 'checkbox';
  required: boolean;
}

export default function CreateEventScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Basic Information
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('music');
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [coverBase64, setCoverBase64] = useState<string | null>(null);

  // Location
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Lagos');
  const [state, setState] = useState('Lagos State');

  // Dates (Stored as ISO Strings)
  // Default start to tomorrow at 6:00 PM, end 10:00 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(22, 0, 0, 0);

  const [startDateTime, setStartDateTime] = useState(tomorrow.toISOString().slice(0, 16));
  const [endDateTime, setEndDateTime] = useState(tomorrowEnd.toISOString().slice(0, 16));

  // Ticket Tiers
  const [tiers, setTiers] = useState<TicketTierInput[]>([
    { id: '1', name: 'Regular', priceNaira: '2500', capacity: '100' },
  ]);

  // Custom Questions
  const [customQuestions, setCustomQuestions] = useState<CustomQuestionInput[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pick Cover Flyer
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
        setCoverImageUri(result.assets[0].uri);
        setCoverBase64(result.assets[0].base64 || null);
      }
    } catch (err: any) {
      Alert.alert('Image Picker Error', err.message || 'Could not select photo');
    }
  };

  // Add / Remove Ticket Tiers
  const handleAddTier = () => {
    setTiers((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: prev.length === 1 ? 'VIP' : `Tier ${prev.length + 1}`,
        priceNaira: '5000',
        capacity: '50',
      },
    ]);
  };

  const handleRemoveTier = (id: string) => {
    if (tiers.length <= 1) {
      Alert.alert('Required', 'You must have at least one ticket tier.');
      return;
    }
    setTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTier = (id: string, field: keyof TicketTierInput, value: string) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleAddQuestion = () => {
    setCustomQuestions((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        question_text: '',
        type: 'text',
        required: false,
      },
    ]);
  };

  const handleRemoveQuestion = (id: string) => {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleUpdateQuestion = (
    id: string,
    field: keyof CustomQuestionInput,
    value: any
  ) => {
    setCustomQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  // Create & Publish Event
  const handleSaveEvent = async (status: 'published' | 'draft') => {
    if (!user) {
      Alert.alert('Auth Required', 'Please sign in to create an event.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Event title is required.');
      return;
    }
    if (!venueName.trim()) {
      Alert.alert('Validation Error', 'Venue name is required.');
      return;
    }

    // Validate Tiers
    for (const tier of tiers) {
      if (!tier.name.trim()) {
        Alert.alert('Validation Error', 'All ticket tiers must have a name.');
        return;
      }
      const cap = parseInt(tier.capacity, 10);
      if (isNaN(cap) || cap <= 0) {
        Alert.alert('Validation Error', `Ticket tier "${tier.name}" must have a valid capacity.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let uploadedCoverUrl: string | null = null;

      // 1. Upload cover flyer if chosen
      if (coverBase64) {
        const fileExt = coverImageUri?.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}/${Date.now()}_cover.${fileExt}`;

        const binaryString = atob(coverBase64);
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

        if (uploadError) {
          console.warn('Cover upload warning:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('event-covers')
            .getPublicUrl(fileName);
          uploadedCoverUrl = publicUrlData.publicUrl;
        }
      }

      // Generate clean slug
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      const slug = `${baseSlug || 'event'}-${uniqueSuffix}`;

      // 2. Insert event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          title: title.trim(),
          slug,
          description: description.trim() || null,
          category,
          start_datetime: new Date(startDateTime).toISOString(),
          end_datetime: new Date(endDateTime).toISOString(),
          venue_name: venueName.trim(),
          address: address.trim() || null,
          city: city.trim() || 'Lagos',
          state: state.trim() || 'Lagos State',
          cover_image_url: uploadedCoverUrl,
          organizer_id: user.id,
          status,
        } as any)
        .select()
        .single();

      if (eventError) throw eventError;

      // 3. Insert ticket tiers
      const tiersToInsert = tiers.map((t) => {
        const priceNairaNum = parseFloat(t.priceNaira) || 0;
        const capacityNum = parseInt(t.capacity, 10) || 100;
        return {
          event_id: eventData.id,
          name: t.name.trim(),
          price_kobo: Math.round(priceNairaNum * 100),
          capacity: capacityNum,
          remaining: capacityNum,
        };
      });

      const { error: tiersError } = await supabase
        .from('ticket_types')
        .insert(tiersToInsert as any);

      if (tiersError) throw tiersError;

      // 4. Insert custom checkout questions if any
      const validQuestions = customQuestions.filter((q) => q.question_text.trim());
      if (validQuestions.length > 0) {
        const questionsToInsert = validQuestions.map((q, idx) => ({
          event_id: eventData.id,
          question_text: q.question_text.trim(),
          type: q.type,
          required: q.required,
          position: idx,
        }));

        await supabase.from('checkout_questions').insert(questionsToInsert as any);
      }

      Alert.alert(
        'Success',
        status === 'published'
          ? 'Event published successfully! Attendees can now discover and purchase tickets.'
          : 'Event draft saved.',
        [
          {
            text: 'View in Portal',
            onPress: () => router.replace('/events'),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Create Event Failed', err.message || 'Could not save event.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Text style={styles.headerTitle}>Create New Event</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Photo Picker */}
        <TouchableOpacity
          style={styles.coverUploadBox}
          onPress={handlePickCover}
          activeOpacity={0.8}
        >
          {coverImageUri ? (
            <Image source={{ uri: coverImageUri }} style={styles.coverPreview} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Camera size={32} color={colors.primary} style={{ marginBottom: 8 }} />
              <Text style={styles.uploadTitle}>Upload Event Flyer</Text>
              <Text style={styles.uploadSubtitle}>Tap to choose a 16:9 banner image</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Basic Info */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Basic Information</Text>

          <Input
            label="Event Title *"
            placeholder="e.g. Lagos Afrobeats Festival 2026"
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
            placeholder="Tell attendees what to expect, who is performing, age limit, etc."
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        {/* Date and Time */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Date & Time</Text>

          <Input
            label="Starts (YYYY-MM-DDTHH:MM)"
            placeholder="e.g. 2026-11-20T18:00"
            value={startDateTime}
            onChangeText={setStartDateTime}
          />

          <Input
            label="Ends (YYYY-MM-DDTHH:MM)"
            placeholder="e.g. 2026-11-20T23:00"
            value={endDateTime}
            onChangeText={setEndDateTime}
          />
        </View>

        {/* Location */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Venue & Location</Text>

          <Input
            label="Venue Name *"
            placeholder="e.g. Landmark Centre, Water Corporation Drive"
            value={venueName}
            onChangeText={setVenueName}
          />

          <Input
            label="Street Address"
            placeholder="Plot 2&3, Water Corporation Road, Oniru"
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.twoColumn}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="City"
                placeholder="Lagos"
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Input
                label="State"
                placeholder="Lagos State"
                value={state}
                onChangeText={setState}
              />
            </View>
          </View>
        </View>

        {/* Ticket Tiers */}
        <View style={styles.sectionCard}>
          <View style={styles.tierHeaderRow}>
            <Text style={styles.sectionHeader}>Ticket Tiers</Text>
            <TouchableOpacity
              style={styles.addTierBtn}
              onPress={handleAddTier}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.primary} />
              <Text style={styles.addTierBtnText}>Add Tier</Text>
            </TouchableOpacity>
          </View>

          {tiers.map((tier, idx) => (
            <View key={tier.id} style={styles.tierBox}>
              <View style={styles.tierTopRow}>
                <Text style={styles.tierIndexLabel}>Tier #{idx + 1}</Text>
                {tiers.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveTier(tier.id)}>
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <Input
                label="Tier Name"
                placeholder="e.g. Early Bird, VIP, Table of 5"
                value={tier.name}
                onChangeText={(val) => handleUpdateTier(tier.id, 'name', val)}
              />

              <View style={styles.twoColumn}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Input
                    label="Price (₦)"
                    placeholder="0 for free"
                    keyboardType="numeric"
                    value={tier.priceNaira}
                    onChangeText={(val) => handleUpdateTier(tier.id, 'priceNaira', val)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Input
                    label="Capacity"
                    placeholder="e.g. 100"
                    keyboardType="numeric"
                    value={tier.capacity}
                    onChangeText={(val) => handleUpdateTier(tier.id, 'capacity', val)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Custom Checkout Questions */}
        <View style={styles.sectionCard}>
          <View style={styles.tierHeaderRow}>
            <View>
              <Text style={styles.sectionHeader}>Custom Questions</Text>
              <Text style={styles.sectionSubtitle}>
                Ask buyers for additional info (e.g. T-Shirt Size, Company)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addTierBtn}
              onPress={handleAddQuestion}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.primary} />
              <Text style={styles.addTierBtnText}>Add Question</Text>
            </TouchableOpacity>
          </View>

          {customQuestions.length === 0 ? (
            <Text style={styles.emptyPrompt}>No custom questions added. (Optional)</Text>
          ) : (
            customQuestions.map((q, idx) => (
              <View key={q.id} style={styles.tierBox}>
                <View style={styles.tierTopRow}>
                  <Text style={styles.tierIndexLabel}>Question #{idx + 1}</Text>
                  <TouchableOpacity onPress={() => handleRemoveQuestion(q.id)}>
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>

                <Input
                  label="Question Prompt"
                  placeholder="e.g. What is your T-shirt size?"
                  value={q.question_text}
                  onChangeText={(val) => handleUpdateQuestion(q.id, 'question_text', val)}
                />

                <View style={styles.questionOptionsRow}>
                  <View style={styles.typeSelectorRow}>
                    {(['text', 'long_text', 'checkbox'] as const).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.qTypePill,
                          q.type === t && styles.qTypePillSelected,
                        ]}
                        onPress={() => handleUpdateQuestion(q.id, 'type', t)}
                      >
                        <Text
                          style={[
                            styles.qTypeText,
                            q.type === t && styles.qTypeTextSelected,
                          ]}
                        >
                          {t === 'text' ? 'Text' : t === 'long_text' ? 'Paragraph' : 'Checkbox'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.requiredToggle,
                      q.required && styles.requiredToggleActive,
                    ]}
                    onPress={() => handleUpdateQuestion(q.id, 'required', !q.required)}
                  >
                    <Text
                      style={[
                        styles.requiredToggleText,
                        q.required && styles.requiredToggleTextActive,
                      ]}
                    >
                      {q.required ? 'Required *' : 'Optional'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Submission Buttons */}
        <View style={styles.submitSection}>
          <Button
            title="Publish Event"
            variant="primary"
            loading={isSubmitting}
            onPress={() => handleSaveEvent('published')}
            style={{ marginBottom: 10 }}
          />

          <Button
            title="Save as Draft"
            variant="outline"
            disabled={isSubmitting}
            onPress={() => handleSaveEvent('draft')}
          />
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
    borderStyle: 'dashed',
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
  uploadSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
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
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  addTierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addTierBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  tierBox: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  tierTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierIndexLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  submitSection: {
    marginTop: 8,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  emptyPrompt: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  questionOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  qTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qTypePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  qTypeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  qTypeTextSelected: {
    color: '#fff',
  },
  requiredToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requiredToggleActive: {
    borderColor: colors.warning,
    backgroundColor: `${colors.warning}18`,
  },
  requiredToggleText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  requiredToggleTextActive: {
    color: colors.warning,
  },
});
