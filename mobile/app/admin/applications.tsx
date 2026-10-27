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
  Linking,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  Search,
  Eye,
  ShieldCheck,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';

interface OrganizerApp {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  social_media_link: string | null;
  reason: string;
  id_photo_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function OrganizerApplicationsScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
  const [applications, setApplications] = useState<OrganizerApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selected application for detail review modal
  const [selectedApp, setSelectedApp] = useState<OrganizerApp | null>(null);
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  // Decision Modal State
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      setErrorMsg('');
      const { data, error } = await supabase
        .from('organizer_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications((data as OrganizerApp[]) || []);
    } catch (err: any) {
      console.warn('[OrganizerApplications] Fetch error:', err);
      setErrorMsg(err.message || 'Failed to load organizer applications');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchApplications();
  };

  // Open detail modal and generate 15-min signed URL for ID photo
  const handleInspectApplication = async (app: OrganizerApp) => {
    setSelectedApp(app);
    setSignedPhotoUrl(null);
    setIsLoadingPhoto(true);

    try {
      // If id_photo_url is already a full URL or a storage path
      if (app.id_photo_url.startsWith('http://') || app.id_photo_url.startsWith('https://')) {
        setSignedPhotoUrl(app.id_photo_url);
      } else {
        const { data, error } = await supabase.storage
          .from('id-photos')
          .createSignedUrl(app.id_photo_url, 900); // 15 mins

        if (error) {
          console.warn('[OrganizerApplications] Storage signed URL error:', error);
        } else if (data?.signedUrl) {
          setSignedPhotoUrl(data.signedUrl);
        }
      }
    } catch (err) {
      console.warn('[OrganizerApplications] Error resolving signed ID URL:', err);
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  // Submit Approval or Rejection
  const handleConfirmDecision = async () => {
    if (!selectedApp || !decisionType) return;
    setIsSubmittingDecision(true);

    try {
      if (decisionType === 'approve') {
        const { error } = await supabase.rpc(
          'approve_organizer_application' as any,
          {
            p_application_id: selectedApp.id,
            p_note: adminNote.trim() || null,
          }
        );
        if (error) throw error;
        Alert.alert('Approved', `${selectedApp.full_name} is now an authorized organizer.`);
      } else {
        const { error } = await supabase.rpc(
          'reject_organizer_application' as any,
          {
            p_application_id: selectedApp.id,
            p_note: adminNote.trim() || null,
          }
        );
        if (error) throw error;
        Alert.alert('Rejected', `The application has been marked as rejected.`);
      }

      setDecisionType(null);
      setAdminNote('');
      setSelectedApp(null);
      fetchApplications();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not process decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesTab =
      activeTab === 'pending' ? app.status === 'pending' : app.status !== 'pending';

    if (!matchesTab) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      app.full_name?.toLowerCase().includes(query) ||
      app.email?.toLowerCase().includes(query) ||
      app.phone_number?.toLowerCase().includes(query)
    );
  });

  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const resolvedCount = applications.filter((a) => a.status !== 'pending').length;

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Restricted" showBack />
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Admin Access Required</Text>
          <Text style={styles.emptySubtitle}>
            Only administrators are authorized to review organizer applications.
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
      <Header title="Organizer Applications" showBack />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pending')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'pending' && styles.tabButtonTextActive]}
          >
            Pending Review ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'resolved' && styles.tabButtonActive]}
          onPress={() => setActiveTab('resolved')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'resolved' && styles.tabButtonTextActive]}
          >
            Resolved ({resolvedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by name, email or phone..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching applications...</Text>
        </View>
      ) : (
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

          {filteredApps.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FileCheck2 size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {activeTab === 'pending'
                  ? 'No pending applications'
                  : 'No resolved applications found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'pending'
                  ? 'All organizer applications have been reviewed. Good job!'
                  : 'Applications that you approve or reject will appear here.'}
              </Text>
            </View>
          ) : (
            filteredApps.map((app) => {
              const isPending = app.status === 'pending';
              const isApproved = app.status === 'approved';

              return (
                <TouchableOpacity
                  key={app.id}
                  style={styles.appCard}
                  onPress={() => handleInspectApplication(app)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.applicantInfo}>
                      <Text style={styles.applicantName}>{app.full_name}</Text>
                      <Text style={styles.applicantEmail}>{app.email}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isPending
                          ? styles.statusBadgePending
                          : isApproved
                          ? styles.statusBadgeApproved
                          : styles.statusBadgeRejected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isPending
                            ? styles.statusBadgeTextPending
                            : isApproved
                            ? styles.statusBadgeTextApproved
                            : styles.statusBadgeTextRejected,
                        ]}
                      >
                        {app.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Phone size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>{app.phone_number}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Clock size={13} color={colors.textMuted} />
                    <Text style={styles.metaText}>
                      {new Date(app.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>

                  <Text style={styles.reasonExcerpt} numberOfLines={2}>
                    "{app.reason}"
                  </Text>

                  {app.admin_note ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteTitle}>Admin Note:</Text>
                      <Text style={styles.noteText}>{app.admin_note}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <View style={styles.inspectHint}>
                      <Eye size={14} color={colors.primary} />
                      <Text style={styles.inspectHintText}>View KYC & Verify</Text>
                    </View>

                    {isPending && (
                      <View style={styles.actionPill}>
                        <Text style={styles.actionPillText}>Needs Review</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Detail / KYC Inspection Modal */}
      <Modal
        visible={Boolean(selectedApp)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedApp(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedApp && (
                <>
                  <View style={styles.sheetHeader}>
                    <View>
                      <Text style={styles.sheetTitle}>{selectedApp.full_name}</Text>
                      <Text style={styles.sheetSubtitle}>KYC Verification Dossier</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedApp(null)}
                      style={styles.closeBtn}
                    >
                      <XCircle size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Applicant Attributes */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Mail size={16} color={colors.textMuted} />
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>{selectedApp.email}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Phone size={16} color={colors.textMuted} />
                      <Text style={styles.detailLabel}>Phone:</Text>
                      <Text style={styles.detailValue}>{selectedApp.phone_number}</Text>
                    </View>
                    {selectedApp.social_media_link ? (
                      <TouchableOpacity
                        style={styles.detailRow}
                        onPress={() => {
                          const url = selectedApp.social_media_link?.startsWith('http')
                            ? selectedApp.social_media_link
                            : `https://${selectedApp.social_media_link}`;
                          Linking.openURL(url).catch(() =>
                            Alert.alert('Invalid URL', 'Could not open social media link.')
                          );
                        }}
                      >
                        <ExternalLink size={16} color={colors.primary} />
                        <Text style={styles.detailLabel}>Social Media:</Text>
                        <Text style={[styles.detailValue, { color: colors.primary }]}>
                          {selectedApp.social_media_link}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Pitch / Bio */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionHeader}>Organizer Vision & Plan</Text>
                    <View style={styles.pitchCard}>
                      <Text style={styles.pitchText}>{selectedApp.reason}</Text>
                    </View>
                  </View>

                  {/* Government ID Document Photo */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionHeader}>Government ID Document</Text>
                    <Text style={styles.idHelper}>
                      Signed secure document stream. Valid for 15 minutes.
                    </Text>

                    {isLoadingPhoto ? (
                      <View style={styles.photoLoadingWrap}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.photoLoadingText}>Loading identity document...</Text>
                      </View>
                    ) : signedPhotoUrl ? (
                      <View style={styles.photoWrapper}>
                        <Image
                          source={{ uri: signedPhotoUrl }}
                          style={styles.idPhoto}
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <View style={styles.noPhotoWrap}>
                        <AlertCircle size={20} color={colors.error} />
                        <Text style={styles.noPhotoText}>
                          Could not generate signed image access link.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons for Pending */}
                  {selectedApp.status === 'pending' && (
                    <View style={styles.decisionRow}>
                      <Button
                        title="Reject Application"
                        variant="destructive"
                        onPress={() => setDecisionType('reject')}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Approve Organizer"
                        variant="primary"
                        onPress={() => setDecisionType('approve')}
                        style={{ flex: 1 }}
                      />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Decision Review Note Modal */}
      <Modal
        visible={Boolean(decisionType)}
        transparent
        animationType="fade"
        onRequestClose={() => setDecisionType(null)}
      >
        <View style={styles.noteModalOverlay}>
          <View style={styles.noteModalBox}>
            <Text style={styles.noteModalTitle}>
              {decisionType === 'approve' ? 'Approve Organizer' : 'Reject Application'}
            </Text>
            <Text style={styles.noteModalSubtitle}>
              {decisionType === 'approve'
                ? `Grant ${selectedApp?.full_name} full event organizer rights on TixNaija.`
                : `Decline ${selectedApp?.full_name}'s request to become an organizer.`}
            </Text>

            <Text style={styles.noteInputLabel}>
              Optional Feedback / Note (included in decision email):
            </Text>
            <TextInput
              style={styles.noteTextInput}
              placeholder="e.g. Identity verified via NIN, or ID photo was blurry..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              value={adminNote}
              onChangeText={setAdminNote}
            />

            <View style={styles.noteButtonRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setDecisionType(null)}
                style={{ flex: 1 }}
              />
              <Button
                title={
                  isSubmittingDecision
                    ? 'Processing...'
                    : decisionType === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'
                }
                variant={decisionType === 'approve' ? 'primary' : 'destructive'}
                loading={isSubmittingDecision}
                onPress={handleConfirmDecision}
                style={{ flex: 1 }}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  searchContainer: {
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
    fontSize: 17,
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
  appCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  applicantInfo: {
    flex: 1,
    marginRight: 10,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  applicantEmail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusBadgeApproved: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
  },
  statusBadgeRejected: {
    backgroundColor: 'rgba(229, 90, 90, 0.15)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusBadgeTextPending: {
    color: '#f59e0b',
  },
  statusBadgeTextApproved: {
    color: colors.success,
  },
  statusBadgeTextRejected: {
    color: colors.error,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaDot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reasonExcerpt: {
    fontSize: 13,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 10,
    borderRadius: 8,
  },
  noteBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 2,
  },
  noteText: {
    fontSize: 12,
    color: colors.text,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inspectHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inspectHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  actionPill: {
    backgroundColor: 'rgba(242, 97, 30, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
  },
  // Inspection Modal Styles
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
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  detailSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
    width: 90,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  pitchCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    padding: 12,
  },
  pitchText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  idHelper: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  photoLoadingWrap: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
  },
  photoLoadingText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  photoWrapper: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  idPhoto: {
    width: '100%',
    height: '100%',
  },
  noPhotoWrap: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 90, 90, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  noPhotoText: {
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  // Note Modal
  noteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noteModalBox: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  noteModalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  noteInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 6,
  },
  noteTextInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noteButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
});
