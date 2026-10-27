import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Tag,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Percent,
  Calendar,
} from 'lucide-react-native';

import { supabase } from '../../../src/supabase/client';
import { colors } from '../../../src/theme/colors';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { LoadingState } from '../../../src/components/LoadingState';
import { EmptyState } from '../../../src/components/EmptyState';

interface PromoCodeItem {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  times_used: number;
  active: boolean;
  expires_at: string | null;
}

export default function EventPromosScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [promos, setPromos] = useState<PromoCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxUses, setMaxUses] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchPromos = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('event_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromos(data || []);
    } catch (err: any) {
      console.warn('Error fetching promo codes:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPromos();
  };

  const handleCreatePromo = async () => {
    if (!id) return;
    if (!code.trim()) {
      Alert.alert('Validation Error', 'Promo code text is required.');
      return;
    }
    const valNum = parseFloat(discountValue);
    if (isNaN(valNum) || valNum <= 0) {
      Alert.alert('Validation Error', 'Discount value must be greater than zero.');
      return;
    }
    if (discountType === 'percent' && valNum > 100) {
      Alert.alert('Validation Error', 'Percentage discount cannot exceed 100%.');
      return;
    }

    setIsCreating(true);
    try {
      const maxUsesNum = maxUses.trim() ? parseInt(maxUses, 10) : null;

      // If fixed, convert Naira input to kobo
      const finalDiscountValue = discountType === 'fixed' ? Math.round(valNum * 100) : valNum;

      const { error } = await supabase.from('promo_codes').insert({
        event_id: id,
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: finalDiscountValue,
        max_uses: maxUsesNum,
        active: true,
      } as any);

      if (error) throw error;

      setIsModalVisible(false);
      setCode('');
      setDiscountValue('10');
      setMaxUses('');
      Alert.alert('Success', `Promo code ${code.toUpperCase()} is now live.`);
      await fetchPromos();
    } catch (err: any) {
      Alert.alert('Create Error', err.message || 'Failed to create promo code.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (promo: PromoCodeItem) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ active: !promo.active } as any)
        .eq('id', promo.id);

      if (error) throw error;
      await fetchPromos();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update status');
    }
  };

  const handleDeletePromo = (promo: PromoCodeItem) => {
    Alert.alert(
      'Delete Promo Code',
      `Are you sure you want to delete promo "${promo.code}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('promo_codes')
                .delete()
                .eq('id', promo.id);

              if (error) throw error;
              await fetchPromos();
            } catch (err: any) {
              Alert.alert('Delete Error', err.message || 'Could not delete promo code');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return <LoadingState message="Loading promo codes..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promo Codes</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>New Code</Text>
        </TouchableOpacity>
      </View>

      {promos.length === 0 ? (
        <EmptyState
          title="No Promo Codes"
          message="Create discount codes (percentage or fixed amount) to boost ticket sales."
        />
      ) : (
        <FlatList
          data={promos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const discountDisplay =
              item.discount_type === 'percent'
                ? `${item.discount_value}% OFF`
                : `₦${Math.floor(item.discount_value / 100).toLocaleString()} OFF`;

            return (
              <View style={styles.promoCard}>
                <View style={styles.promoTopRow}>
                  <View style={styles.codeBadge}>
                    <Tag size={13} color={colors.primary} style={{ marginRight: 5 }} />
                    <Text style={styles.codeText}>{item.code}</Text>
                  </View>
                  <Text style={styles.discountValueText}>{discountDisplay}</Text>
                </View>

                <View style={styles.detailsRow}>
                  <Text style={styles.detailText}>
                    Redeemed: {item.times_used}
                    {item.max_uses ? ` / ${item.max_uses} max` : ' (unlimited)'}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      item.active ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {item.active ? 'ACTIVE' : 'PAUSED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => handleToggleActive(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toggleBtnText}>
                      {item.active ? 'Pause Code' : 'Activate Code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => handleDeletePromo(item)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Create Promo Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Promo Code</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Input
              label="Promo Code *"
              placeholder="e.g. VIP20 or TIXPROMO"
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
            />

            <Text style={styles.fieldLabel}>Discount Type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  discountType === 'percent' && styles.typeBtnSelected,
                ]}
                onPress={() => setDiscountType('percent')}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    discountType === 'percent' && styles.typeBtnTextSelected,
                  ]}
                >
                  Percentage (%)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  discountType === 'fixed' && styles.typeBtnSelected,
                ]}
                onPress={() => setDiscountType('fixed')}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    discountType === 'fixed' && styles.typeBtnTextSelected,
                  ]}
                >
                  Fixed Amount (₦)
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label={discountType === 'percent' ? 'Discount Percentage (%) *' : 'Discount Amount (₦) *'}
              placeholder={discountType === 'percent' ? '15' : '1000'}
              keyboardType="numeric"
              value={discountValue}
              onChangeText={setDiscountValue}
            />

            <Input
              label="Max Total Uses (Optional)"
              placeholder="Leave empty for unlimited"
              keyboardType="numeric"
              value={maxUses}
              onChangeText={setMaxUses}
            />

            <View style={styles.modalButtonRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Create Code"
                variant="primary"
                loading={isCreating}
                onPress={handleCreatePromo}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  promoCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  promoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}22`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  discountValueText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: `${colors.success}22`,
  },
  statusInactive: {
    backgroundColor: colors.surfaceHover,
  },
  statusPillText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  toggleBtn: {
    paddingVertical: 4,
  },
  toggleBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  trashBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  typeBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  typeBtnTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
