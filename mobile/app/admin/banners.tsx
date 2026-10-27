import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Eye,
  MousePointerClick,
  AlertCircle,
  Upload,
  Check,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';

interface SponsoredBanner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  display_order: number;
  click_count: number;
  created_at: string;
}

export default function AdminBannersScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [banners, setBanners] = useState<SponsoredBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<SponsoredBanner | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerLinkUrl, setBannerLinkUrl] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerDisplayOrder, setBannerDisplayOrder] = useState('0');
  const [bannerIsActive, setBannerIsActive] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBanners = useCallback(async () => {
    try {
      setErrorMsg('');
      const { data, error } = await supabase
        .from('sponsored_banners')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanners((data as SponsoredBanner[]) || []);
    } catch (err: any) {
      console.warn('[AdminBanners] Fetch error:', err);
      setErrorMsg(err.message || 'Failed to load banners');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchBanners();
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingBanner(null);
    setBannerTitle('');
    setBannerLinkUrl('');
    setBannerImageUrl('');
    setBannerDisplayOrder('0');
    setBannerIsActive(true);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (banner: SponsoredBanner) => {
    setEditingBanner(banner);
    setBannerTitle(banner.title);
    setBannerLinkUrl(banner.link_url || '');
    setBannerImageUrl(banner.image_url);
    setBannerDisplayOrder(String(banner.display_order ?? 0));
    setBannerIsActive(banner.is_active);
    setIsModalOpen(true);
  };

  // Fast toggle active state
  const handleToggleActive = async (banner: SponsoredBanner) => {
    const updatedState = !banner.is_active;
    try {
      // Optimistic update
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, is_active: updatedState } : b))
      );

      const { error } = await supabase
        .from('sponsored_banners')
        .update({ is_active: updatedState })
        .eq('id', banner.id);

      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update banner status.');
      fetchBanners();
    }
  };

  // Delete banner
  const handleDeleteBanner = (banner: SponsoredBanner) => {
    Alert.alert(
      'Delete Banner',
      `Are you sure you want to remove "${banner.title}" from the platform?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('sponsored_banners')
                .delete()
                .eq('id', banner.id);

              if (error) throw error;
              Alert.alert('Deleted', 'Banner removed successfully.');
              fetchBanners();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete banner.');
            }
          },
        },
      ]
    );
  };

  // Pick Image from Gallery
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is required to upload a banner image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      setIsUploadingImage(true);
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `banner-${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, blob, {
          contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      if (publicData?.publicUrl) {
        setBannerImageUrl(publicData.publicUrl);
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload banner image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save Banner (Insert or Update)
  const handleSaveBanner = async () => {
    if (!bannerTitle.trim()) {
      Alert.alert('Validation Error', 'Banner title is required.');
      return;
    }
    if (!bannerImageUrl.trim()) {
      Alert.alert('Validation Error', 'Please select or enter an image URL.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: bannerTitle.trim(),
        image_url: bannerImageUrl.trim(),
        link_url: bannerLinkUrl.trim() || null,
        display_order: parseInt(bannerDisplayOrder, 10) || 0,
        is_active: bannerIsActive,
      };

      if (editingBanner) {
        const { error } = await supabase
          .from('sponsored_banners')
          .update(payload)
          .eq('id', editingBanner.id);
        if (error) throw error;
        Alert.alert('Success', 'Banner updated successfully.');
      } else {
        const { error } = await supabase
          .from('sponsored_banners')
          .insert(payload);
        if (error) throw error;
        Alert.alert('Success', 'New sponsored banner published.');
      }

      setIsModalOpen(false);
      fetchBanners();
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save banner.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Restricted" showBack />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Admin Access Required</Text>
          <Text style={styles.emptySubtitle}>
            Only administrators are authorized to manage platform advertising banners.
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Sponsored Banners"
        showBack
        rightAction={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={handleOpenCreate}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.headerAddBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading ad banners...</Text>
          </View>
        ) : banners.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ImageIcon size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No sponsored banners yet</Text>
            <Text style={styles.emptySubtitle}>
              Promote featured partners, festival sponsors, or special ticketing campaigns on the homepage.
            </Text>
            <Button
              title="Create First Banner"
              variant="primary"
              onPress={handleOpenCreate}
              style={{ marginTop: 20 }}
            />
          </View>
        ) : (
          banners.map((banner) => (
            <View key={banner.id} style={styles.bannerCard}>
              <View style={styles.bannerImageWrap}>
                <Image
                  source={{ uri: banner.image_url }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                <View
                  style={[
                    styles.activeBadge,
                    banner.is_active ? styles.activeBadgeOn : styles.activeBadgeOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.activeBadgeText,
                      banner.is_active
                        ? styles.activeBadgeTextOn
                        : styles.activeBadgeTextOff,
                    ]}
                  >
                    {banner.is_active ? 'ACTIVE' : 'PAUSED'}
                  </Text>
                </View>
              </View>

              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                {banner.link_url ? (
                  <Text style={styles.bannerLink} numberOfLines={1}>
                    {banner.link_url}
                  </Text>
                ) : (
                  <Text style={styles.bannerNoLink}>No redirect link attached</Text>
                )}

                <View style={styles.bannerMetaRow}>
                  <View style={styles.metaItem}>
                    <MousePointerClick size={14} color={colors.textMuted} />
                    <Text style={styles.metaItemText}>
                      {banner.click_count || 0} Clicks
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaItemLabel}>Priority Order:</Text>
                    <Text style={styles.metaItemValue}>{banner.display_order}</Text>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={styles.bannerActions}>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Active:</Text>
                    <Switch
                      value={banner.is_active}
                      onValueChange={() => handleToggleActive(banner)}
                      thumbColor={banner.is_active ? colors.success : '#888'}
                      trackColor={{ false: colors.border, true: 'rgba(46, 213, 115, 0.4)' }}
                    />
                  </View>

                  <View style={styles.buttonGroup}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleOpenEdit(banner)}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={16} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconButton, styles.deleteButton]}
                      onPress={() => handleDeleteBanner(banner)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>
                {editingBanner ? 'Edit Banner' : 'New Sponsored Banner'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Provide promotional headline, destination link & creative image.
              </Text>

              {/* Banner Image Preview / Upload */}
              <View style={styles.imageSection}>
                <Text style={styles.inputLabel}>Creative Artwork (16:9 recommended)</Text>
                {bannerImageUrl ? (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: bannerImageUrl }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.changeImageBtn}
                      onPress={handlePickImage}
                      disabled={isUploadingImage}
                    >
                      <Upload size={14} color="#fff" />
                      <Text style={styles.changeImageBtnText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadPlaceholder}
                    onPress={handlePickImage}
                    disabled={isUploadingImage}
                    activeOpacity={0.7}
                  >
                    {isUploadingImage ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Upload size={24} color={colors.primary} />
                        <Text style={styles.uploadText}>Select from Photos</Text>
                        <Text style={styles.uploadSubtext}>Uploads to public banners CDN</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <Input
                label="Image Direct URL (Optional alternative)"
                placeholder="https://... image.jpg"
                value={bannerImageUrl}
                onChangeText={setBannerImageUrl}
              />

              <Input
                label="Campaign Title / Headline"
                placeholder="e.g. Flytime Fest 2026 - Early Bird Tickets"
                value={bannerTitle}
                onChangeText={setBannerTitle}
              />

              <Input
                label="Destination Link URL"
                placeholder="https://tixnaija.name.ng/e/my-event"
                value={bannerLinkUrl}
                onChangeText={setBannerLinkUrl}
                autoCapitalize="none"
              />

              <Input
                label="Display Priority Order (Lowest shows first)"
                placeholder="0"
                keyboardType="numeric"
                value={bannerDisplayOrder}
                onChangeText={setBannerDisplayOrder}
              />

              {/* Active Toggle */}
              <View style={styles.modalSwitchRow}>
                <View>
                  <Text style={styles.modalSwitchTitle}>Publish Immediately</Text>
                  <Text style={styles.modalSwitchSub}>
                    Active banners are visible to all visitors on discovery feed
                  </Text>
                </View>
                <Switch
                  value={bannerIsActive}
                  onValueChange={setBannerIsActive}
                  thumbColor={bannerIsActive ? colors.primary : '#888'}
                  trackColor={{ false: colors.border, true: colors.primaryDark }}
                />
              </View>

              <View style={styles.modalButtonRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setIsModalOpen(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={editingBanner ? 'Update Banner' : 'Create Banner'}
                  variant="primary"
                  loading={isSaving}
                  onPress={handleSaveBanner}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  headerAddBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 90, 90, 0.15)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
  bannerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerImageWrap: {
    width: '100%',
    height: 150,
    backgroundColor: '#000',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  activeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeOn: {
    backgroundColor: colors.success,
  },
  activeBadgeOff: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  activeBadgeTextOn: {
    color: '#000',
  },
  activeBadgeTextOff: {
    color: '#fff',
  },
  bannerBody: {
    padding: 14,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  bannerLink: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  bannerNoLink: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItemText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaItemLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaItemValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  bannerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(229, 90, 90, 0.15)',
  },
  // Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
  },
  sheetScroll: {
    maxHeight: '100%',
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  imageSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  uploadPlaceholder: {
    height: 140,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: 6,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  uploadSubtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
  previewContainer: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changeImageBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  changeImageBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginVertical: 8,
  },
  modalSwitchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  modalSwitchSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    maxWidth: 240,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
});
