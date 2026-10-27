import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Users,
  Search,
  ShieldCheck,
  ShieldAlert,
  Ban,
  CheckCircle2,
  Calendar,
  AlertCircle,
  MoreVertical,
  Check,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';

interface AdminUserProfile {
  id: string;
  full_name: string;
  created_at: string;
  suspended: boolean;
  is_verified_organizer: boolean;
  organizer_slug: string | null;
  roles: string[];
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setErrorMsg('');
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, created_at, suspended, is_verified_organizer, organizer_slug')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleMap = new Map<string, string[]>();
      for (const r of rolesRes.data ?? []) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      }

      const mappedUsers: AdminUserProfile[] = (profilesRes.data ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || 'Anonymous User',
        created_at: p.created_at,
        suspended: Boolean(p.suspended),
        is_verified_organizer: Boolean(p.is_verified_organizer),
        organizer_slug: p.organizer_slug,
        roles: roleMap.get(p.id) ?? ['attendee'],
      }));

      setUsers(mappedUsers);
    } catch (err: any) {
      console.warn('[AdminUsers] Fetch error:', err);
      setErrorMsg(err.message || 'Failed to load user directory');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchUsers();
  };

  // Toggle Suspend / Unsuspend
  const handleToggleSuspend = (user: AdminUserProfile) => {
    const nextState = !user.suspended;
    Alert.alert(
      nextState ? 'Suspend User' : 'Unsuspend User',
      nextState
        ? `Are you sure you want to suspend "${user.full_name}"? They will lose access to buy tickets or host events.`
        : `Restore full account access for "${user.full_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextState ? 'Suspend' : 'Restore',
          style: nextState ? 'destructive' : 'default',
          onPress: async () => {
            setProcessingUserId(user.id);
            try {
              const { error } = await supabase.rpc('admin_suspend_user' as any, {
                p_user_id: user.id,
                p_suspended: nextState,
              });
              if (error) throw error;

              Alert.alert(
                'Success',
                nextState ? 'User has been suspended.' : 'User unsuspended.'
              );
              fetchUsers();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update user suspension status.');
            } finally {
              setProcessingUserId(null);
            }
          },
        },
      ]
    );
  };

  // Toggle Verified Organizer
  const handleToggleVerify = async (user: AdminUserProfile) => {
    const nextState = !user.is_verified_organizer;
    setProcessingUserId(user.id);
    try {
      const { error } = await supabase.rpc('admin_verify_organizer' as any, {
        p_user_id: user.id,
        p_verified: nextState,
      });
      if (error) throw error;

      Alert.alert(
        'Success',
        nextState
          ? `Verified badge granted to ${user.full_name}.`
          : `Verified badge removed from ${user.full_name}.`
      );
      fetchUsers();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update organizer verification badge.');
    } finally {
      setProcessingUserId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(query) ||
      u.roles.some((r) => r.toLowerCase().includes(query)) ||
      (u.organizer_slug && u.organizer_slug.toLowerCase().includes(query))
    );
  });

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Restricted" showBack />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Admin Access Required</Text>
          <Text style={styles.emptySubtitle}>
            Only administrators are authorized to manage user accounts.
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
      <Header title="User Directory & Access" showBack />

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by user name or role..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

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
            <Text style={styles.loadingText}>Loading registered users...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No matching users found</Text>
            <Text style={styles.emptySubtitle}>
              Try searching with another name or clear your search query.
            </Text>
          </View>
        ) : (
          filteredUsers.map((item) => {
            const isProcessing = processingUserId === item.id;
            const isSuspended = item.suspended;
            const isVerified = item.is_verified_organizer;

            return (
              <View
                key={item.id}
                style={[styles.userCard, isSuspended && styles.userCardSuspended]}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.userName}>{item.full_name}</Text>
                      {isVerified && (
                        <View style={styles.verifiedBadge}>
                          <CheckCircle2 size={13} color="#fff" />
                          <Text style={styles.verifiedBadgeText}>Verified</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.joinDate}>
                      Joined{' '}
                      {new Date(item.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>

                  {/* Status Indicator */}
                  <View
                    style={[
                      styles.statusPill,
                      isSuspended ? styles.statusPillSuspended : styles.statusPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isSuspended ? styles.statusPillTextSuspended : styles.statusPillTextActive,
                      ]}
                    >
                      {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* Role Badges */}
                <View style={styles.roleRow}>
                  {item.roles.map((r) => (
                    <View
                      key={r}
                      style={[
                        styles.roleChip,
                        r === 'admin'
                          ? styles.roleChipAdmin
                          : r === 'customer_care'
                          ? styles.roleChipCare
                          : r === 'organizer'
                          ? styles.roleChipOrganizer
                          : styles.roleChipAttendee,
                      ]}
                    >
                      <Text style={styles.roleChipText}>{r.toUpperCase()}</Text>
                    </View>
                  ))}
                  {item.organizer_slug && (
                    <Text style={styles.slugText}>@{item.organizer_slug}</Text>
                  )}
                </View>

                {/* Admin Actions */}
                <View style={styles.actionRow}>
                  {/* Verified Organizer Toggle (Only for organizers) */}
                  {item.roles.includes('organizer') && (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isVerified ? styles.actionBtnOutline : styles.actionBtnVerify,
                      ]}
                      onPress={() => handleToggleVerify(item)}
                      disabled={isProcessing}
                      activeOpacity={0.7}
                    >
                      <ShieldCheck
                        size={14}
                        color={isVerified ? colors.textMuted : colors.success}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          isVerified ? { color: colors.textMuted } : { color: colors.success },
                        ]}
                      >
                        {isVerified ? 'Remove Badge' : 'Verify Organizer'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Suspend / Restore Button */}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isSuspended ? styles.actionBtnRestore : styles.actionBtnSuspend,
                    ]}
                    onPress={() => handleToggleSuspend(item)}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ban
                          size={14}
                          color={isSuspended ? colors.success : colors.error}
                        />
                        <Text
                          style={[
                            styles.actionBtnText,
                            { color: isSuspended ? colors.success : colors.error },
                          ]}
                        >
                          {isSuspended ? 'Restore Access' : 'Suspend Account'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 14,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
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
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userCardSuspended: {
    borderColor: 'rgba(229, 90, 90, 0.4)',
    backgroundColor: 'rgba(229, 90, 90, 0.05)',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  joinDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillActive: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
  },
  statusPillSuspended: {
    backgroundColor: 'rgba(229, 90, 90, 0.15)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  statusPillTextActive: {
    color: colors.success,
  },
  statusPillTextSuspended: {
    color: colors.error,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  roleChip: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  roleChipAdmin: {
    backgroundColor: 'rgba(242, 97, 30, 0.2)',
  },
  roleChipCare: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  roleChipOrganizer: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  roleChipAttendee: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
  },
  slugText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnOutline: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnVerify: {
    backgroundColor: 'rgba(46, 213, 115, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(46, 213, 115, 0.3)',
  },
  actionBtnSuspend: {
    backgroundColor: 'rgba(229, 90, 90, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(229, 90, 90, 0.3)',
  },
  actionBtnRestore: {
    backgroundColor: 'rgba(46, 213, 115, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(46, 213, 115, 0.3)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
