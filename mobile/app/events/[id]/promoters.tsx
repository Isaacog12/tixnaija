import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  Share,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Users,
  Copy,
  Share2,
  Trash2,
  TrendingUp,
  Tag,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react-native';

import { supabase } from '../../../src/supabase/client';
import { colors } from '../../../src/theme/colors';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { LoadingState } from '../../../src/components/LoadingState';
import { EmptyState } from '../../../src/components/EmptyState';

interface PromoterItem {
  id: string; // promoter_link id
  unique_code: string;
  active: boolean;
  promoter: {
    name: string;
    contact_info: string | null;
  };
  tierName?: string;
  ticketsSold: number;
  totalGrossKobo: number;
}

export default function EventPromotersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [eventSlug, setEventSlug] = useState('');
  const [promoters, setPromoters] = useState<PromoterItem[]>([]);
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Create Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [uniqueCode, setUniqueCode] = useState('');
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchPromoters = useCallback(async () => {
    if (!id) return;
    try {
      // 1. Fetch event slug
      const { data: eventData } = await supabase
        .from('events')
        .select('slug')
        .eq('id', id)
        .single();

      if (eventData) setEventSlug(eventData.slug);

      // 2. Fetch ticket types
      const { data: typesData } = await supabase
        .from('ticket_types')
        .select('id, name')
        .eq('event_id', id);

      setTicketTypes(typesData || []);

      // 3. Fetch promoter links with attribution orders
      const { data: linksData, error } = await supabase
        .from('promoter_links')
        .select(`
          id,
          unique_code,
          active,
          ticket_type_id,
          promoters (
            name,
            contact_info
          ),
          ticket_types (
            name
          ),
          orders (
            id,
            total_kobo,
            status
          )
        `)
        .eq('event_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: PromoterItem[] = (linksData || []).map((l: any) => {
        let sold = 0;
        let gross = 0;

        (l.orders || []).forEach((o: any) => {
          if (o.status === 'paid') {
            sold += 1;
            gross += o.total_kobo || 0;
          }
        });

        const promoterObj = Array.isArray(l.promoters) ? l.promoters[0] : l.promoters;
        const ticketTypeObj = Array.isArray(l.ticket_types) ? l.ticket_types[0] : l.ticket_types;

        return {
          id: l.id,
          unique_code: l.unique_code,
          active: l.active,
          promoter: {
            name: promoterObj?.name || 'Promoter',
            contact_info: promoterObj?.contact_info || null,
          },
          tierName: ticketTypeObj?.name,
          ticketsSold: sold,
          totalGrossKobo: gross,
        };
      });

      setPromoters(formatted);
    } catch (err: any) {
      console.warn('Error fetching promoters:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPromoters();
  }, [fetchPromoters]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPromoters();
  };

  const handleCreatePromoter = async () => {
    if (!id) return;
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Promoter name is required.');
      return;
    }
    if (!uniqueCode.trim() || uniqueCode.trim().length < 3) {
      Alert.alert('Validation Error', 'Unique code must be at least 3 characters.');
      return;
    }

    setIsCreating(true);
    try {
      // 1. Create promoter record
      const { data: promoterData, error: pErr } = await supabase
        .from('promoters')
        .insert({
          event_id: id,
          name: name.trim(),
          contact_info: contactInfo.trim() || null,
        } as any)
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Create promoter link
      const { error: lErr } = await supabase.from('promoter_links').insert({
        promoter_id: promoterData.id,
        event_id: id,
        ticket_type_id: selectedTicketTypeId,
        unique_code: uniqueCode.trim().toUpperCase(),
        active: true,
      } as any);

      if (lErr) throw lErr;

      Alert.alert('Success', `Promoter ${name.trim()} added with code ${uniqueCode.trim().toUpperCase()}.`);
      setIsModalVisible(false);
      setName('');
      setContactInfo('');
      setUniqueCode('');
      setSelectedTicketTypeId(null);
      await fetchPromoters();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create promoter.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleShareLink = async (promo: PromoterItem) => {
    const url = `https://tixnaija.name.ng/e/${eventSlug}?ref=${promo.unique_code}`;
    try {
      await Share.share({
        message: `Tickets link for promoter ${promo.promoter.name}: ${url}`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleToggleActive = async (item: PromoterItem) => {
    try {
      const { error } = await supabase
        .from('promoter_links')
        .update({ active: !item.active } as any)
        .eq('id', item.id);

      if (error) throw error;
      await fetchPromoters();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update promoter link.');
    }
  };

  const formatNaira = (kobo: number) => `₦${Math.floor(kobo / 100).toLocaleString()}`;

  if (isLoading) {
    return <LoadingState message="Loading promoters roster..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Affiliates & Promoters</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>Add Promoter</Text>
        </TouchableOpacity>
      </View>

      {promoters.length === 0 ? (
        <EmptyState
          title="No Promoters Yet"
          message="Recruit promoters and influencers. Generate trackable links with sales attribution."
        />
      ) : (
        <FlatList
          data={promoters}
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
            const promoLink = `https://tixnaija.name.ng/e/${eventSlug}?ref=${item.unique_code}`;

            return (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoterName}>{item.promoter.name}</Text>
                    {item.promoter.contact_info && (
                      <Text style={styles.contactText}>{item.promoter.contact_info}</Text>
                    )}
                  </View>
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

                {/* Referral Code Badge */}
                <View style={styles.refRow}>
                  <View style={styles.codeBadge}>
                    <Tag size={12} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.codeText}>{item.unique_code}</Text>
                  </View>
                  {item.tierName && (
                    <Text style={styles.tierScopeText}>Tier: {item.tierName}</Text>
                  )}
                </View>

                {/* Performance Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{item.ticketsSold}</Text>
                    <Text style={styles.statLabel}>Orders Attributed</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{formatNaira(item.totalGrossKobo)}</Text>
                    <Text style={styles.statLabel}>Gross Sales</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.shareLinkBtn}
                    onPress={() => handleShareLink(item)}
                    activeOpacity={0.7}
                  >
                    <Share2 size={14} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.shareLinkBtnText}>Share Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => handleToggleActive(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.toggleBtnText}>
                      {item.active ? 'Pause Link' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Promoter Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Promoter</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Input
              label="Promoter Name *"
              placeholder="e.g. Tunde Alabi / Pulse NG"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Contact Info"
              placeholder="e.g. 08012345678 or promoter@example.com"
              value={contactInfo}
              onChangeText={setContactInfo}
            />

            <Input
              label="Unique Referral Code *"
              placeholder="e.g. TUNDE2026"
              autoCapitalize="characters"
              value={uniqueCode}
              onChangeText={setUniqueCode}
            />

            {ticketTypes.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>Scoping (Optional)</Text>
                <View style={styles.tierScroll}>
                  <TouchableOpacity
                    style={[
                      styles.tierPill,
                      selectedTicketTypeId === null && styles.tierPillSelected,
                    ]}
                    onPress={() => setSelectedTicketTypeId(null)}
                  >
                    <Text
                      style={[
                        styles.tierPillText,
                        selectedTicketTypeId === null && styles.tierPillTextSelected,
                      ]}
                    >
                      All Tiers
                    </Text>
                  </TouchableOpacity>
                  {ticketTypes.map((tt) => {
                    const isSelected = selectedTicketTypeId === tt.id;
                    return (
                      <TouchableOpacity
                        key={tt.id}
                        style={[styles.tierPill, isSelected && styles.tierPillSelected]}
                        onPress={() => setSelectedTicketTypeId(tt.id)}
                      >
                        <Text
                          style={[
                            styles.tierPillText,
                            isSelected && styles.tierPillTextSelected,
                          ]}
                        >
                          {tt.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Add Promoter"
                variant="primary"
                loading={isCreating}
                onPress={handleCreatePromoter}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  promoterName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  contactText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
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
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}22`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierScopeText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHover,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  shareLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  shareLinkBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  toggleBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
  tierScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  tierPillText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tierPillTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
