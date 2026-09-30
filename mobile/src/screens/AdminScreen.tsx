import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { ShieldAlert, Users, LayoutTemplate, Briefcase, ExternalLink, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const handleLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  const renderAdminItem = (icon: any, title: string, subtitle: string, url: string) => (
    <TouchableOpacity style={styles.adminItem} onPress={() => handleLink(url)}>
      <View style={styles.adminIconContainer}>
        {icon}
      </View>
      <View style={styles.adminTextContainer}>
        <Text style={styles.adminTitle}>{title}</Text>
        <Text style={styles.adminSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.adminRight}>
        <ExternalLink color="#767069" size={18} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}>
      <Text style={styles.pageTitle}>Admin Console</Text>
      <Text style={styles.pageSubtitle}>Manage the TixNaija platform</Text>

      <View style={styles.sectionCard}>
        {renderAdminItem(
          <ShieldAlert color="#f4f2f0" size={20} />, 
          "Platform Overview", 
          "View metrics and global settings",
          "https://tixnaija.name.ng/admin"
        )}
        <View style={styles.divider} />
        {renderAdminItem(
          <Users color="#f4f2f0" size={20} />, 
          "Organizer Applications", 
          "Review and approve organizers",
          "https://tixnaija.name.ng/admin/organizer-applications"
        )}
        <View style={styles.divider} />
        {renderAdminItem(
          <Briefcase color="#f4f2f0" size={20} />, 
          "Job Applications", 
          "Manage hiring and careers",
          "https://tixnaija.name.ng/admin/job-applications"
        )}
        <View style={styles.divider} />
        {renderAdminItem(
          <LayoutTemplate color="#f4f2f0" size={20} />, 
          "Home Banners", 
          "Update featured event banners",
          "https://tixnaija.name.ng/admin/banners"
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
    paddingTop: 100,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 4,
    marginTop: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#8e8b85',
    marginBottom: 24,
  },
  sectionCard: {
    backgroundColor: 'rgba(46, 42, 40, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  adminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  adminIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  adminTextContainer: {
    flex: 1,
  },
  adminTitle: {
    fontSize: 16,
    color: '#f4f2f0',
    fontWeight: '500',
  },
  adminSubtitle: {
    fontSize: 13,
    color: '#767069',
    marginTop: 2,
  },
  adminRight: {
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 72, 
  },
});
