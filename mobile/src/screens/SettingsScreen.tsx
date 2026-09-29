import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, Switch } from 'react-native';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { supabase } from '../../supabase/client';
import { ChevronRight, User, Bell, Shield, HelpCircle, FileText, LogOut, Download, Lock } from 'lucide-react-native';

export default function SettingsScreen({ navigation }: any) {
  const { checkVersion } = useVersionCheck();
  const [user, setUser] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
    });
  }, []);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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
          () => handleLink('https://tixnaija.name.ng/account')
        )}
        <View style={styles.divider} />
        {renderSettingItem(
          <Lock color="#f4f2f0" size={20} />, 
          "Security", 
          "Change password and auth methods",
          () => handleLink('https://tixnaija.name.ng/account')
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
            onValueChange={setNotificationsEnabled}
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
    paddingBottom: 40,
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
  }
});
