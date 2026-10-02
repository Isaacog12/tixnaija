import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { supabase } from '../../supabase/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RefreshCw, WifiOff } from 'lucide-react-native';

export default function ScanTicketsScreen() {
  const insets = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  useEffect(() => {
    checkPendingCount();
    const getBarCodeScannerPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();

    // Aggressive background sync every 30 seconds
    const interval = setInterval(() => {
      // Only trigger if not already syncing to prevent overlapping requests
      setSyncing((prev) => {
        if (!prev) {
          handleSync(true);
        }
        return prev;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkPendingCount = async () => {
    try {
      const pendingStr = await AsyncStorage.getItem('@pending_offline_scans');
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        setOfflinePendingCount(pending.length);
      }
    } catch (e) {}
  };

  const handleSync = async (silent = false) => {
    setSyncing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      // 1. Flush pending scans
      const pendingStr = await AsyncStorage.getItem('@pending_offline_scans');
      let pendingScans: { ticket_code: string; scanned_at: string }[] = pendingStr ? JSON.parse(pendingStr) : [];
      
      let flushSuccess = 0;
      if (pendingScans.length > 0) {
        // Bulk sync in a single optimized request
        const { data: syncRes, error: syncErr } = await supabase.rpc('bulk_sync_offline_checkins' as any, { 
          p_scans: pendingScans 
        });
        
        if (syncErr) throw syncErr;
        
        if (syncRes.success) {
          flushSuccess = syncRes.synced_count;
          console.log(`Synced ${flushSuccess}, Failed ${syncRes.failed_count}`);
          // Clear queue since we processed them
          await AsyncStorage.setItem('@pending_offline_scans', JSON.stringify([]));
          setOfflinePendingCount(0);
        } else {
          throw new Error(syncRes.error || 'Failed to sync bulk scans');
        }
      }

      // 2. Download fresh tickets
      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select('id, ticket_code, status, attendee_name, order_items!inner(ticket_types!inner(name, events!inner(organizer_id)))')
        .eq('order_items.ticket_types.events.organizer_id', userData.user.id);
        
      if (error) throw error;
      
      await AsyncStorage.setItem('@offline_tickets', JSON.stringify(ticketsData || []));
      if (!silent) {
        Alert.alert('Sync Complete', `Downloaded ${ticketsData?.length || 0} tickets for offline scanning.\nSynced ${flushSuccess} pending scans.`);
      }
    } catch (err: any) {
      if (!silent) {
        Alert.alert('Sync Error', err.message);
      }
    } finally {
      setSyncing(false);
      checkPendingCount();
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setLoading(true);
    try {
      // STRATEGY 1: OFFLINE-FIRST
      // Always check the local database first because it is 0ms latency.
      const ticketsStr = await AsyncStorage.getItem('@offline_tickets');
      if (ticketsStr) {
        let offlineTickets = JSON.parse(ticketsStr);
        const ticketIndex = offlineTickets.findIndex((t: any) => t.id === data || t.ticket_code === data);
        
        if (ticketIndex !== -1) {
          const ticket = offlineTickets[ticketIndex];
          if (ticket.status === 'scanned' || ticket.status === 'checked_in') {
            Alert.alert('Already Checked In (Offline)', `${ticket.attendee_name || 'Attendee'} was already checked in.`, [{ text: 'OK', onPress: () => setScanned(false) }]);
            setLoading(false);
            return;
          }

          // Mark as scanned locally
          offlineTickets[ticketIndex].status = 'scanned';
          await AsyncStorage.setItem('@offline_tickets', JSON.stringify(offlineTickets));

          // Add to pending sync queue with exact timestamp
          const pendingStr = await AsyncStorage.getItem('@pending_offline_scans');
          let pendingScans: { ticket_code: string; scanned_at: string }[] = pendingStr ? JSON.parse(pendingStr) : [];
          pendingScans.push({
            ticket_code: data,
            scanned_at: new Date().toISOString()
          });
          await AsyncStorage.setItem('@pending_offline_scans', JSON.stringify(pendingScans));
          setOfflinePendingCount(pendingScans.length);

          Alert.alert(
            'Success! (Offline Mode)', 
            `${ticket.attendee_name || 'Attendee'} checked in perfectly.`, 
            [{ text: 'OK', onPress: () => setScanned(false) }]
          );
          setLoading(false);
          return;
        }
      }

      // STRATEGY 2: THE "SLIVER OF NETWORK" FALLBACK
      // If the ticket wasn't found locally, it might be a brand new purchase.
      // We attempt a single micro-request to the server to verify it.
      const { data: ticketResult, error } = await supabase.rpc('check_in_ticket' as any, {
        p_ticket_code: data
      });

      if (error) throw error;

      if (!ticketResult.success) {
        Alert.alert('Scan Failed', ticketResult.error || 'Invalid ticket code.', [
          { text: 'Try Again', onPress: () => setScanned(false) }
        ]);
        return;
      }

      if (ticketResult.already_checked_in) {
        Alert.alert(
          'Already Checked In', 
          `${ticketResult.attendee_name || 'Attendee'} (${ticketResult.ticket_name})\nChecked in at: ${new Date(ticketResult.checked_in_at).toLocaleString()}`, 
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      } else {
        Alert.alert(
          'Success! (Online Fallback)', 
          `${ticketResult.attendee_name || 'Attendee'} (${ticketResult.ticket_name}) has been checked in successfully!`, 
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('network') || err.message?.toLowerCase().includes('fetch')) {
         Alert.alert('Scan Failed', 'Ticket not found in local database, and you have no internet connection to verify it.', [{ text: 'Try Again', onPress: () => setScanned(false) }]);
      } else {
        Alert.alert('Scan Error', err.message, [
          { text: 'Try Again', onPress: () => setScanned(false) }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) {
    return <Text style={styles.text}>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text style={styles.text}>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { top: insets.top + 16 }]}>
        <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
          <RefreshCw color="#f4f2f0" size={18} />
          <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : 'Sync Offline Data'}</Text>
        </TouchableOpacity>
        {offlinePendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <WifiOff color="#fff" size={12} />
            <Text style={styles.pendingText}>{offlinePendingCount} pending</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#f2611e" />
          <Text style={styles.overlayText}>Verifying ticket...</Text>
        </View>
      ) : null}

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={[styles.instructions, { bottom: 100 + insets.bottom }]}>
        <Text style={styles.instructionsText}>Point your camera at a ticket QR code to scan</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
  },
  instructions: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    borderRadius: 8,
  },
  instructionsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  overlayText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
  },
  header: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 97, 30, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  syncBtnText: {
    color: '#f4f2f0',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e55a5a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  pendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  }
});
