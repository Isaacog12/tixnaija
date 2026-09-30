import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, Switch, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { supabase } from '../../supabase/client';
import { ChevronRight, User, Bell, Shield, HelpCircle, FileText, LogOut, Download, Lock, Trash2 } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen({ navigation }: any) {
  const { checkVersion } = useVersionCheck();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Modal states
  const [personalInfoVisible, setPersonalInfoVisible] = useState(false);
  const [securityVisible, setSecurityVisible] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setName(session.user.user_metadata?.full_name || '');
        setPhone(session.user.user_metadata?.phone || '');
      }
    });
    
    // Check current notification status
    Notifications.getPermissionsAsync().then(settings => {
      setNotificationsEnabled(settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
    });
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Permission required', 'Failed to get push token for push notification!');
        setNotificationsEnabled(false);
        return;
      }
      
      // Get token and save to backend
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '87928ff1-f32b-4a1b-8d41-ea77c28f71d0' // From app.json
        });
        await supabase.from('profiles').update({ expo_push_token: tokenData.data } as any).eq('id', user.id);
      } catch (err) {
        console.error("Failed to get push token", err);
      }
      
      setNotificationsEnabled(true);
    } else {
      // Delete token from backend
      try {
        await supabase.from('profiles').update({ expo_push_token: null } as any).eq('id', user.id);
      } catch (err) {
        console.error("Failed to remove push token", err);
      }
      setNotificationsEnabled(false);
      Alert.alert('Notifications Disabled', 'You can turn them off completely from your Phone Settings.');
    }
  };

  const handleSavePersonalInfo = async () => {
    setIsSavingInfo(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name, phone: phone }
    });
    setIsSavingInfo(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      if (data?.user) setUser(data.user);
      setPersonalInfoVisible(false);
      Alert.alert("Success", "Personal information updated.");
    }
  };

  const handleSaveSecurity = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    setIsSavingSecurity(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    setIsSavingSecurity(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setNewPassword('');
      setSecurityVisible(false);
      Alert.alert("Success", "Password updated successfully.");
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) Alert.alert('Error logging out', error.message);
          }
        }
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This action is permanent and cannot be undone. All your tickets and events will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_user_account' as any);
              if (error) throw error;
              await supabase.auth.signOut();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete account.');
            }
          }
        }
      ]
    );
  };

  const handleLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  const renderSettingItem = (icon: any, title: string, subtitle?: string, onPress?: () => void, rightElement?: any) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingIconContainer}>
        {icon}
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.settingRight}>
        {rightElement || (onPress && <ChevronRight color="#767069" size={20} />)}
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}>
      <Text style={styles.pageTitle}>Settings</Text>
      
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {user?.user_metadata?.full_name || 'TixNaija User'}
          </Text>
          <Text style={styles.profileEmail}>
            {user?.email || 'user@example.com'}
          </Text>
        </View>
      </View>

      {/* Account Section */}
      {renderSectionHeader('Account')}
      <View style={styles.sectionCard}>
        {renderSettingItem(
          <User color="#f4f2f0" size={20} />, 
          "Personal Information", 
          "Update your name and phone",
          () => setPersonalInfoVisible(true)
        )}
        <View style={styles.divider} />
        {renderSettingItem(
          <Lock color="#f4f2f0" size={20} />, 
          "Security", 
          "Change password and auth methods",
          () => setSecurityVisible(true)
        )}
      </View>

      {/* Preferences Section */}
      {renderSectionHeader('Preferences')}
      <View style={styles.sectionCard}>
        {renderSettingItem(
          <Bell color="#f4f2f0" size={20} />, 
          "Push Notifications", 
          "Updates on your events",
          undefined,
          <Switch 
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: "#403b38", true: "#f2611e" }}
            thumbColor="#f4f2f0"
          />
        )}
      </View>

      {/* Support Section */}
      {renderSectionHeader('Support & Legal')}
      <View style={styles.sectionCard}>
        {renderSettingItem(
          <HelpCircle color="#f4f2f0" size={20} />, 
          "Help Center", 
          "FAQ and contact support",
          () => handleLink('https://tixnaija.name.ng/contact')
        )}
        <View style={styles.divider} />
        {renderSettingItem(
          <FileText color="#f4f2f0" size={20} />, 
          "Terms of Service", 
          undefined,
          () => handleLink('https://tixnaija.name.ng/terms')
        )}
        <View style={styles.divider} />
        {renderSettingItem(
          <Shield color="#f4f2f0" size={20} />, 
          "Privacy Policy", 
          undefined,
          () => handleLink('https://tixnaija.name.ng/privacy')
        )}
      </View>

      {/* App Section */}
      {renderSectionHeader('App')}
      <View style={styles.sectionCard}>
        {renderSettingItem(
          <Download color="#f4f2f0" size={20} />, 
          "Check for Updates", 
          "Make sure you have the latest features",
          () => checkVersion(true)
        )}
      </View>
      
      {/* Danger Zone */}
      {renderSectionHeader('Danger Zone')}
      <View style={styles.sectionCard}>
        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleDeleteAccount}
        >
          <View style={[styles.settingIconContainer, { backgroundColor: 'rgba(229, 90, 90, 0.1)' }]}>
            <Trash2 color="#e55a5a" size={20} />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: '#e55a5a' }]}>Delete Account</Text>
            <Text style={styles.settingSubtitle}>Permanently delete your data</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <LogOut color="#e55a5a" size={20} style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
      
      <Text style={styles.versionText}>TixNaija v1.0.0</Text>
    </ScrollView>

    {/* Personal Info Modal */}
    <Modal visible={personalInfoVisible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Personal Information</Text>
          
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#767069"
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            placeholderTextColor="#767069"
            keyboardType="phone-pad"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setPersonalInfoVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSavePersonalInfo} disabled={isSavingInfo}>
              {isSavingInfo ? <ActivityIndicator color="#22201e" size="small" /> : <Text style={styles.modalSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Security Modal */}
    <Modal visible={securityVisible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Security</Text>
          
          <Text style={styles.inputLabel}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter a new password"
            placeholderTextColor="#767069"
            secureTextEntry
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setSecurityVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveSecurity} disabled={isSavingSecurity}>
              {isSavingSecurity ? <ActivityIndicator color="#22201e" size="small" /> : <Text style={styles.modalSaveText}>Update</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#22201e',
    paddingTop: 100 
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // increased to clear bottom tab bar
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 24,
    marginTop: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f2611e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#22201e',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#c2bdb8',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#767069',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#f4f2f0',
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#767069',
    marginTop: 2,
  },
  settingRight: {
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 72, 
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229, 90, 90, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(229, 90, 90, 0.3)',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: {
    color: '#e55a5a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: '#767069',
    fontSize: 12,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#2c2a28',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#a39e99',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1917',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#f4f2f0',
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 16,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#f4f2f0',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#f2611e',
    paddingVertical: 16,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#22201e',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
