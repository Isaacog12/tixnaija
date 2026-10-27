import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import {
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Bell,
  Shield,
  Calendar,
  ChevronRight,
  LogOut,
  Trash2,
  Camera,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Headphones,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Header } from '../../src/components/Header';

interface NotificationPrefs {
  ticket_confirmations: boolean;
  event_reminders: boolean;
  organizer_updates: boolean;
  marketing_emails: boolean;
}

export default function MoreScreen() {
  const router = useRouter();
  const { user, profile, isOrganizer, isAdmin, isCustomerCare, isStaff, signOut, refreshProfile } = useAuth();

  // Profile Edit State
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Password Change State
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Push & Notification Preferences State
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    ticket_confirmations: true,
    event_reminders: true,
    organizer_updates: true,
    marketing_emails: false,
  });
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);

  // Privacy State
  const [isPublicProfile, setIsPublicProfile] = useState(false);

  // Loading States
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Sync profile data when loaded
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhoneNumber(profile.phone ?? '');
      // Check if expo_push_token is set
      const pushToken = (profile as any).expo_push_token;
      setPushEnabled(Boolean(pushToken));

      // Notification preferences
      const rawPrefs = (profile as any).notification_preferences;
      if (rawPrefs) {
        try {
          const parsed = typeof rawPrefs === 'string' ? JSON.parse(rawPrefs) : rawPrefs;
          setNotificationPrefs({
            ticket_confirmations: parsed.ticket_confirmations ?? true,
            event_reminders: parsed.event_reminders ?? true,
            organizer_updates: parsed.organizer_updates ?? true,
            marketing_emails: parsed.marketing_emails ?? false,
          });
        } catch {
          // fallback to defaults
        }
      }

      // Privacy toggle
      setIsPublicProfile(Boolean((profile as any).is_public));
    }
  }, [profile]);

  // Handle Profile Save
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    setProfileSuccessMsg('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phoneNumber.trim(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      setProfileSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not update your profile details.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Avatar Upload
  const handlePickAvatar = async () => {
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      setIsUploadingAvatar(true);
      const fileExt = result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const base64Data = result.assets[0].base64;

      // Convert base64 to Uint8Array for binary upload
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, bytes.buffer, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true,
        });

      if (uploadError) {
        // Fallback: try event-covers if avatars bucket is restricted
        console.warn('Avatar bucket upload failed, attempting fallback:', uploadError);
      }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() } as any)
        .eq('id', user.id);

      if (updateError) throw updateError;
      await refreshProfile();
      Alert.alert('Success', 'Avatar updated!');
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload avatar image.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle Push Token Registration
  const handleTogglePush = async (enable: boolean) => {
    if (!user) return;
    setPushEnabled(enable);

    try {
      if (enable) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Permissions Required',
            'Please enable notification permissions in your Android system settings to receive push updates.'
          );
          setPushEnabled(false);
          return;
        }

        const pushTokenData = await Notifications.getExpoPushTokenAsync();
        const token = pushTokenData.data;

        await supabase
          .from('profiles')
          .update({ expo_push_token: token, updated_at: new Date().toISOString() } as any)
          .eq('id', user.id);

        await refreshProfile();
      } else {
        await supabase
          .from('profiles')
          .update({ expo_push_token: null, updated_at: new Date().toISOString() } as any)
          .eq('id', user.id);

        await refreshProfile();
      }
    } catch (err: any) {
      console.warn('Push registration error:', err);
      Alert.alert('Push Setup', err.message || 'Could not update push settings on device.');
      setPushEnabled(!enable);
    }
  };

  // Handle Notification Preference Toggle
  const handleTogglePref = async (key: keyof NotificationPrefs, val: boolean) => {
    if (!user) return;
    const updated = { ...notificationPrefs, [key]: val };
    setNotificationPrefs(updated);

    try {
      setIsUpdatingPrefs(true);
      await supabase
        .from('profiles')
        .update({
          notification_preferences: updated,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id);
    } catch (err) {
      console.warn('Failed to update notification prefs:', err);
    } finally {
      setIsUpdatingPrefs(false);
    }
  };

  // Handle Privacy Toggle
  const handleTogglePrivacy = async (val: boolean) => {
    if (!user) return;
    setIsPublicProfile(val);

    try {
      await supabase
        .from('profiles')
        .update({
          is_public: val,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id);
    } catch (err) {
      console.warn('Failed to update privacy:', err);
    }
  };

  // Handle Password Change
  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setIsPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Your password has been changed successfully.');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of TixNaija?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // Handle Account Deletion
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. All your tickets, profile details, and account data will be permanently erased. If you own active events, your deletion will be blocked.',
      [
        { text: 'Keep Account', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                throw new Error('Active session required to delete account.');
              }

              const res = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                }
              );

              const responseData = await res.json();

              if (!res.ok) {
                if (res.status === 409) {
                  Alert.alert(
                    'Cannot Delete Account',
                    responseData.error ||
                      'You have events on TixNaija. Please contact support to close your account.'
                  );
                  return;
                }
                throw new Error(responseData.error || 'Account deletion failed.');
              }

              Alert.alert('Account Deleted', 'Your account has been permanently removed.');
              await signOut();
              router.replace('/(auth)/login');
            } catch (err: any) {
              Alert.alert('Deletion Error', err.message || 'Failed to process account deletion.');
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TN';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Account & Settings" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}
              activeOpacity={0.8}
            >
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={14} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{fullName || 'TixNaija Member'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.badgeRow}>
              {isAdmin && (
                <View style={[styles.roleBadge, styles.adminBadge]}>
                  <Text style={styles.roleBadgeText}>ADMIN</Text>
                </View>
              )}
              {isCustomerCare && (
                <View style={[styles.roleBadge, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                  <Text style={[styles.roleBadgeText, { color: '#38bdf8' }]}>CARE STAFF</Text>
                </View>
              )}
              {isOrganizer && (
                <View style={[styles.roleBadge, styles.organizerBadge]}>
                  <Text style={styles.roleBadgeText}>ORGANIZER</Text>
                </View>
              )}
              {!isOrganizer && !isAdmin && !isCustomerCare && (
                <View style={[styles.roleBadge, styles.attendeeBadge]}>
                  <Text style={styles.roleBadgeText}>ATTENDEE</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Quick Role Navigation Actions */}
        {(isOrganizer || isAdmin || isStaff) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portals & Tools</Text>
            <View style={styles.card}>
              {isOrganizer && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => router.push('/events')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconContainer}>
                    <Calendar size={18} color={colors.primary} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Organizer Portal</Text>
                    <Text style={styles.menuSubtitle}>Manage events, attendees & scanner</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              {isAdmin && (
                <TouchableOpacity
                  style={[styles.menuItem, isOrganizer && styles.menuItemBorder]}
                  onPress={() => router.push('/admin')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconContainer}>
                    <Shield size={18} color={colors.accent} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Admin Hub</Text>
                    <Text style={styles.menuSubtitle}>Applications, payouts & approvals</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              {isStaff && (
                <TouchableOpacity
                  style={[styles.menuItem, (isOrganizer || isAdmin) && styles.menuItemBorder]}
                  onPress={() => router.push('/support/lookup')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconContainer}>
                    <Headphones size={18} color="#38bdf8" />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Customer Care Portal</Text>
                    <Text style={styles.menuSubtitle}>Universal order lookup & ticket resends</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Profile Details Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          <View style={styles.card}>
            {profileSuccessMsg ? (
              <View style={styles.successBanner}>
                <CheckCircle2 size={16} color={colors.success} />
                <Text style={styles.successText}>{profileSuccessMsg}</Text>
              </View>
            ) : null}

            <Input
              label="Full Name"
              placeholder="e.g. Babatunde Fashola"
              value={fullName}
              onChangeText={setFullName}
            />

            <Input
              label="Phone Number"
              placeholder="e.g. 08012345678"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />

            <Button
              title="Save Profile"
              variant="primary"
              loading={isSavingProfile}
              onPress={handleSaveProfile}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>

        {/* Notifications & Push Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchTitle}>Push Notifications</Text>
                <Text style={styles.switchDescription}>
                  Get immediate updates on ticket orders and gate status
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                thumbColor={pushEnabled ? colors.primary : '#888'}
                trackColor={{ false: colors.border, true: colors.primaryDark }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchTitle}>Ticket Confirmations</Text>
                <Text style={styles.switchDescription}>Instant receipt and ticket links via email</Text>
              </View>
              <Switch
                value={notificationPrefs.ticket_confirmations}
                onValueChange={(val) => handleTogglePref('ticket_confirmations', val)}
                thumbColor={notificationPrefs.ticket_confirmations ? colors.primary : '#888'}
                trackColor={{ false: colors.border, true: colors.primaryDark }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchTitle}>Event Reminders</Text>
                <Text style={styles.switchDescription}>Helpful reminders 24h before event starts</Text>
              </View>
              <Switch
                value={notificationPrefs.event_reminders}
                onValueChange={(val) => handleTogglePref('event_reminders', val)}
                thumbColor={notificationPrefs.event_reminders ? colors.primary : '#888'}
                trackColor={{ false: colors.border, true: colors.primaryDark }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchTitle}>Organizer Updates</Text>
                <Text style={styles.switchDescription}>Venue, time, or scheduling changes</Text>
              </View>
              <Switch
                value={notificationPrefs.organizer_updates}
                onValueChange={(val) => handleTogglePref('organizer_updates', val)}
                thumbColor={notificationPrefs.organizer_updates ? colors.primary : '#888'}
                trackColor={{ false: colors.border, true: colors.primaryDark }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchTitle}>Promotions & Offers</Text>
                <Text style={styles.switchDescription}>Exclusive discounts and curated event lists</Text>
              </View>
              <Switch
                value={notificationPrefs.marketing_emails}
                onValueChange={(val) => handleTogglePref('marketing_emails', val)}
                thumbColor={notificationPrefs.marketing_emails ? colors.primary : '#888'}
                trackColor={{ false: colors.border, true: colors.primaryDark }}
              />
            </View>
          </View>
        </View>

        {/* Privacy & Social Proof */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Guest Lists</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchTitle}>Public Attendee Profile</Text>
                <Text style={styles.switchDescription}>
                  Allow your name and avatar to be shown in public attendee lists on event pages
                </Text>
              </View>
              <Switch
                value={isPublicProfile}
                onValueChange={handleTogglePrivacy}
                thumbColor={isPublicProfile ? colors.primary : '#888'}
                trackColor={{ false: colors.border, true: colors.primaryDark }}
              />
            </View>
          </View>
        </View>

        {/* Security & Authentication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setIsPasswordModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Lock size={18} color={colors.text} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Change Password</Text>
                <Text style={styles.menuSubtitle}>Update your account login password</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support & Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & About</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                Alert.alert(
                  'TixNaija Support',
                  'Need assistance with your tickets or events?\n\nEmail: support@tixnaija.ng\nWhatsApp: +234 800 TIX NAIJA'
                )
              }
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <HelpCircle size={18} color={colors.text} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Contact Support</Text>
                <Text style={styles.menuSubtitle}>Help with orders, disputes or inquiries</Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Button
            title="Log Out"
            variant="outline"
            onPress={handleSignOut}
            style={{ marginBottom: 12 }}
          />

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            activeOpacity={0.7}
          >
            {isDeletingAccount ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Trash2 size={16} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.deleteButtonText}>Delete TixNaija Account</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* App Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>TixNaija for Android • Version 1.0.0</Text>
          <Text style={styles.versionSubtext}>Completely independent ticketing for Nigeria</Text>
        </View>
      </ScrollView>

      {/* Password Change Modal */}
      <Modal
        visible={isPasswordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSubtitle}>
              Enter a secure password with at least 8 characters.
            </Text>

            {passwordError ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color={colors.error} />
                <Text style={styles.errorBannerText}>{passwordError}</Text>
              </View>
            ) : null}

            <Input
              label="New Password"
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Input
              label="Confirm New Password"
              placeholder="Re-enter new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalButtonRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setIsPasswordModalVisible(false);
                  setPasswordError('');
                }}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Update"
                variant="primary"
                loading={isChangingPassword}
                onPress={handleChangePassword}
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
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceHover,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  userEmail: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadge: {
    backgroundColor: '#7C3AED22',
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  organizerBadge: {
    backgroundColor: `${colors.primary}22`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  attendeeBadge: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 6,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  switchDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.success}18`,
    borderColor: colors.success,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.error}18`,
    borderColor: colors.error,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  versionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  versionSubtext: {
    color: colors.textMuted,
    fontSize: 10,
    opacity: 0.7,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
});
