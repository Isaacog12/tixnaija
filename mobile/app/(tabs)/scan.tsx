import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  TextInput,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Camera,
  Flashlight,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  ChevronDown,
  Keyboard,
  X,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase/client';
import { colors } from '../../src/theme/colors';
import { Button } from '../../src/components/Button';
import { Header } from '../../src/components/Header';

interface EventItem {
  id: string;
  title: string;
  start_datetime: string;
  status: string;
}

interface ScanResult {
  status: 'valid' | 'already_used' | 'invalid';
  message: string;
  attendeeName?: string;
  ticketName?: string;
  timestamp: string;
}

interface OfflineScanItem {
  ticket_code: string;
  scanned_at: string;
}

export default function GateScannerScreen() {
  const { user, isOrganizer, isAdmin, isLoading: authLoading } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  // Scanner Configuration State
  const [torchOn, setTorchOn] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(true);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);

  // Events Selection State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isEventModalVisible, setIsEventModalVisible] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Offline Sync State
  const [offlineScans, setOfflineScans] = useState<OfflineScanItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloadingManifest, setIsDownloadingManifest] = useState(false);
  const [manifestCount, setManifestCount] = useState<number>(0);

  // Manual Code Input Modal
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const scanLockRef = useRef(false);

  // Load Events on Mount
  useEffect(() => {
    if (user && (isOrganizer || isAdmin)) {
      loadOrganizerEvents();
    }
  }, [user, isOrganizer, isAdmin]);

  // Load offline queue & manifest count when selectedEvent changes
  useEffect(() => {
    if (selectedEvent) {
      loadLocalState(selectedEvent.id);
    }
  }, [selectedEvent]);

  const loadOrganizerEvents = async () => {
    if (!user) return;
    setIsLoadingEvents(true);
    try {
      let query = supabase
        .from('events')
        .select('id, title, start_datetime, status')
        .order('start_datetime', { ascending: false });

      // Non-admins only see events they own
      if (!isAdmin) {
        query = query.eq('organizer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        setEvents(data);
        // Default to first active or upcoming event
        const active = data.find((e) => e.status === 'published') || data[0];
        setSelectedEvent(active);
      }
    } catch (err: any) {
      console.warn('Error loading scanner events:', err);
      Alert.alert('Events Error', 'Could not load your event list for scanning.');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const loadLocalState = async (eventId: string) => {
    try {
      // Load offline scans queue
      const rawScans = await AsyncStorage.getItem(`@offline_scans_${eventId}`);
      if (rawScans) {
        setOfflineScans(JSON.parse(rawScans));
      } else {
        setOfflineScans([]);
      }

      // Check manifest
      const rawManifest = await AsyncStorage.getItem(`@manifest_${eventId}`);
      if (rawManifest) {
        const manifestObj = JSON.parse(rawManifest);
        setManifestCount(Object.keys(manifestObj).length);
      } else {
        setManifestCount(0);
      }
    } catch (err) {
      console.warn('Error loading local scanner state:', err);
    }
  };

  // Download Manifest for selected event (for offline gate operation)
  const handleDownloadManifest = async () => {
    if (!selectedEvent) return;
    setIsDownloadingManifest(true);
    try {
      // Query all tickets for this event
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_code, status, attendee_name, order_items!inner(ticket_types!inner(event_id, name))')
        .eq('order_items.ticket_types.event_id', selectedEvent.id);

      if (error) throw error;

      const manifestMap: Record<string, { attendee_name: string; ticket_name: string; status: string }> = {};
      (data || []).forEach((t: any) => {
        manifestMap[t.ticket_code] = {
          attendee_name: t.attendee_name || 'Attendee',
          ticket_name: t.order_items?.ticket_types?.name || 'General Admission',
          status: t.status,
        };
      });

      await AsyncStorage.setItem(`@manifest_${selectedEvent.id}`, JSON.stringify(manifestMap));
      setManifestCount(Object.keys(manifestMap).length);
      Alert.alert('Manifest Ready', `Downloaded ${Object.keys(manifestMap).length} tickets for offline gate scanning.`);
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Could not cache ticket manifest.');
    } finally {
      setIsDownloadingManifest(false);
    }
  };

  // Sync Offline Scans to Database
  const handleSyncOfflineScans = async () => {
    if (!selectedEvent || offlineScans.length === 0) return;
    setIsSyncing(true);
    try {
      const payload = offlineScans.map((s) => ({
        ticket_code: s.ticket_code,
        scanned_at: s.scanned_at,
      }));

      const { data, error } = await supabase.rpc('bulk_sync_offline_checkins', {
        p_scans: payload,
        p_event_id: selectedEvent.id,
      });

      if (error) throw error;

      const res = data as any;
      const failedScans: OfflineScanItem[] = Array.isArray(res.failed_scans)
        ? res.failed_scans
        : res.failed_count > 0
          ? offlineScans
          : [];
      Alert.alert(
        'Offline Sync Complete',
        `Synced: ${res.synced_count ?? 0}\nStill pending: ${failedScans.length}`
      );

      if (failedScans.length > 0) {
        await AsyncStorage.setItem(
          `@offline_scans_${selectedEvent.id}`,
          JSON.stringify(failedScans)
        );
      } else {
        await AsyncStorage.removeItem(`@offline_scans_${selectedEvent.id}`);
      }
      setOfflineScans(failedScans);
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to sync offline scans to server.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Process a Scanned Ticket Code (Online or Offline)
  const processTicketCode = useCallback(
    async (code: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setIsScanningActive(false);

      const trimmedCode = code.trim();
      const nowIso = new Date().toISOString();

      try {
        if (isOfflineMode) {
          // Offline Validation
          if (!selectedEvent) {
            throw new Error('Please select an event before scanning.');
          }

          const rawManifest = await AsyncStorage.getItem(`@manifest_${selectedEvent.id}`);
          const manifest = rawManifest ? JSON.parse(rawManifest) : null;

          if (!manifest || !manifest[trimmedCode]) {
            Vibration.vibrate([0, 200, 100, 200]);
            setLastScanResult({
              status: 'invalid',
              message: 'Ticket not found in offline manifest for this event.',
              timestamp: new Date().toLocaleTimeString(),
            });
            return;
          }

          const ticketInfo = manifest[trimmedCode];

          // Check if already in local offline queue
          const isAlreadyScannedLocally = offlineScans.some((s) => s.ticket_code === trimmedCode);
          if (ticketInfo.status === 'checked_in' || isAlreadyScannedLocally) {
            Vibration.vibrate([0, 100, 100, 100]);
            setLastScanResult({
              status: 'already_used',
              message: 'Already Checked In',
              attendeeName: ticketInfo.attendee_name,
              ticketName: ticketInfo.ticket_name,
              timestamp: new Date().toLocaleTimeString(),
            });
            return;
          }

          // Mark checked in offline
          const newQueue = [...offlineScans, { ticket_code: trimmedCode, scanned_at: nowIso }];
          setOfflineScans(newQueue);
          await AsyncStorage.setItem(`@offline_scans_${selectedEvent.id}`, JSON.stringify(newQueue));

          Vibration.vibrate(150);
          setLastScanResult({
            status: 'valid',
            message: 'Checked In Successfully (Saved Offline)',
            attendeeName: ticketInfo.attendee_name,
            ticketName: ticketInfo.ticket_name,
            timestamp: new Date().toLocaleTimeString(),
          });
        } else {
          // Online Validation via RPC check_in_ticket
          if (!selectedEvent) {
            throw new Error('Please select an event before scanning.');
          }
          const { data, error } = await supabase.rpc('check_in_ticket', {
            p_ticket_code: trimmedCode,
            p_event_id: selectedEvent.id,
          });

          if (error) throw error;

          const res = data as any;
          if (!res.success) {
            Vibration.vibrate([0, 200, 100, 200]);
            setLastScanResult({
              status: 'invalid',
              message: res.error || 'Invalid Ticket',
              timestamp: new Date().toLocaleTimeString(),
            });
          } else if (res.already_checked_in) {
            Vibration.vibrate([0, 100, 100, 100]);
            const timeStr = res.checked_in_at
              ? new Date(res.checked_in_at).toLocaleTimeString()
              : 'Earlier';
            setLastScanResult({
              status: 'already_used',
              message: `Already Checked In at ${timeStr}`,
              attendeeName: res.attendee_name,
              ticketName: res.ticket_name,
              timestamp: new Date().toLocaleTimeString(),
            });
          } else {
            Vibration.vibrate(150);
            setLastScanResult({
              status: 'valid',
              message: 'Checked In Successfully!',
              attendeeName: res.attendee_name,
              ticketName: res.ticket_name,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        }
      } catch (err: any) {
        Vibration.vibrate([0, 200, 100, 200]);
        setLastScanResult({
          status: 'invalid',
          message: err.message || 'Scan error occurred.',
          timestamp: new Date().toLocaleTimeString(),
        });
      } finally {
        // Unlock after 2.5 seconds to prevent camera flutter
        setTimeout(() => {
          scanLockRef.current = false;
          setIsScanningActive(true);
        }, 2500);
      }
    },
    [isOfflineMode, selectedEvent, offlineScans]
  );

  // Manual Check-in Handler
  const handleManualCheckIn = async () => {
    if (!manualCode.trim()) return;
    setIsSubmittingManual(true);
    await processTicketCode(manualCode.trim());
    setIsSubmittingManual(false);
    setIsManualModalVisible(false);
    setManualCode('');
  };

  // Not authorized screen
  if (!authLoading && (!user || (!isOrganizer && !isAdmin))) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Gate Scanner" />
        <View style={styles.emptyContainer}>
          <View style={styles.lockIconBox}>
            <AlertTriangle size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Organizer Access Required</Text>
          <Text style={styles.emptySubtitle}>
            The gate scanner is restricted to verified event organizers and platform administrators.
            To scan tickets at your venue, please sign in with an organizer account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Camera permission prompt
  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header title="Gate Scanner" />
        <View style={styles.emptyContainer}>
          <Camera size={44} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Camera Permission Needed</Text>
          <Text style={styles.emptySubtitle}>
            TixNaija requires camera access to scan attendee QR codes quickly at the gate.
          </Text>
          <Button
            title="Enable Camera Access"
            variant="primary"
            onPress={requestPermission}
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Scanner Control Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.eventSelector}
          onPress={() => setIsEventModalVisible(true)}
          activeOpacity={0.7}
        >
          <Calendar size={14} color={colors.primary} />
          <Text style={styles.eventSelectorText} numberOfLines={1}>
            {selectedEvent ? selectedEvent.title : 'Select Event'}
          </Text>
          <ChevronDown size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.modeControls}>
          <TouchableOpacity
            style={[styles.modeButton, isOfflineMode && styles.modeButtonActive]}
            onPress={() => setIsOfflineMode(!isOfflineMode)}
            activeOpacity={0.7}
          >
            {isOfflineMode ? (
              <WifiOff size={16} color={colors.warning} />
            ) : (
              <Wifi size={16} color={colors.success} />
            )}
            <Text
              style={[
                styles.modeButtonText,
                { color: isOfflineMode ? colors.warning : colors.success },
              ]}
            >
              {isOfflineMode ? 'Offline' : 'Online'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, torchOn && styles.iconButtonActive]}
            onPress={() => setTorchOn(!torchOn)}
            activeOpacity={0.7}
          >
            <Flashlight size={18} color={torchOn ? colors.primary : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera Viewport */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torchOn}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={
            isScanningActive
              ? ({ data }) => {
                  if (data) processTicketCode(data);
                }
              : undefined
          }
        />

        {/* Reticle Overlay */}
        <View style={styles.overlay}>
          <View style={styles.reticleBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.overlayHint}>
            {isScanningActive ? 'Align attendee QR code within the frame' : 'Verifying ticket...'}
          </Text>
        </View>
      </View>

      {/* Scan Result Feedback Card */}
      {lastScanResult && (
        <View
          style={[
            styles.resultCard,
            lastScanResult.status === 'valid' && styles.resultCardValid,
            lastScanResult.status === 'already_used' && styles.resultCardWarning,
            lastScanResult.status === 'invalid' && styles.resultCardInvalid,
          ]}
        >
          <View style={styles.resultHeader}>
            {lastScanResult.status === 'valid' && (
              <CheckCircle2 size={24} color={colors.success} />
            )}
            {lastScanResult.status === 'already_used' && (
              <AlertTriangle size={24} color={colors.warning} />
            )}
            {lastScanResult.status === 'invalid' && <XCircle size={24} color={colors.error} />}

            <View style={styles.resultTextContainer}>
              <Text style={styles.resultTitle}>{lastScanResult.message}</Text>
              {lastScanResult.attendeeName && (
                <Text style={styles.resultAttendee}>{lastScanResult.attendeeName}</Text>
              )}
              {lastScanResult.ticketName && (
                <Text style={styles.resultTicketType}>{lastScanResult.ticketName}</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Bottom Action Footer */}
      <View style={styles.bottomBar}>
        {isOfflineMode && (
          <View style={styles.offlineStatusBar}>
            <Text style={styles.offlineStatusText}>
              Cached: {manifestCount} tickets • Pending Scans: {offlineScans.length}
            </Text>
            <View style={styles.offlineActionsRow}>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={handleDownloadManifest}
                disabled={isDownloadingManifest}
              >
                {isDownloadingManifest ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <RefreshCw size={12} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.actionPillText}>Update Manifest</Text>
                  </>
                )}
              </TouchableOpacity>

              {offlineScans.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionPill, styles.syncPill]}
                  onPress={handleSyncOfflineScans}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.syncPillText}>Sync ({offlineScans.length})</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.manualActionRow}>
          <TouchableOpacity
            style={styles.manualEntryBtn}
            onPress={() => setIsManualModalVisible(true)}
            activeOpacity={0.7}
          >
            <Keyboard size={16} color={colors.text} style={{ marginRight: 6 }} />
            <Text style={styles.manualEntryBtnText}>Enter Ticket Code Manually</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Event Selection Modal */}
      <Modal
        visible={isEventModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEventModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Event for Gate</Text>
              <TouchableOpacity onPress={() => setIsEventModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {isLoadingEvents ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ padding: 24 }} />
            ) : (
              <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 8 }}
                renderItem={({ item }) => {
                  const isSelected = selectedEvent?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.eventPickItem, isSelected && styles.eventPickItemSelected]}
                      onPress={() => {
                        setSelectedEvent(item);
                        setIsEventModalVisible(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.eventPickTitle,
                            isSelected && { color: colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.eventPickDate}>
                          {new Date(item.start_datetime).toLocaleDateString()}
                        </Text>
                      </View>
                      {isSelected && <CheckCircle2 size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Manual Code Input Modal */}
      <Modal
        visible={isManualModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsManualModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual Ticket Entry</Text>
              <TouchableOpacity onPress={() => setIsManualModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Type the full ticket UUID code printed under the attendee QR code.
            </Text>

            <TextInput
              style={styles.codeTextInput}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              placeholderTextColor={colors.textMuted}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsManualModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Check In"
                variant="primary"
                loading={isSubmittingManual}
                onPress={handleManualCheckIn}
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
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  eventSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    maxWidth: '55%',
    gap: 6,
  },
  eventSelectorText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  modeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeButtonActive: {
    borderColor: colors.warning,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButtonActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBox: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  overlayHint: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  resultCard: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    zIndex: 20,
    backgroundColor: colors.surface,
  },
  resultCardValid: {
    borderColor: colors.success,
    backgroundColor: '#062816f0',
  },
  resultCardWarning: {
    borderColor: colors.warning,
    backgroundColor: '#2b1e06f0',
  },
  resultCardInvalid: {
    borderColor: colors.error,
    backgroundColor: '#2e0a0df0',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  resultAttendee: {
    color: '#eee',
    fontSize: 14,
    fontWeight: '600',
  },
  resultTicketType: {
    color: '#bbb',
    fontSize: 12,
    marginTop: 2,
  },
  bottomBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  offlineStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  offlineStatusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  offlineActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  syncPill: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  syncPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  manualActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceHover,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualEntryBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}18`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
    maxHeight: '80%',
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
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  eventPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eventPickItemSelected: {
    backgroundColor: colors.surfaceHover,
  },
  eventPickTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventPickDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  codeTextInput: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
  },
});
