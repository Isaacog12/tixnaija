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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      // 1. Flush pending scans
      const pendingStr = await AsyncStorage.getItem('@pending_offline_scans');
      let pendingScans: string[] = pendingStr ? JSON.parse(pendingStr) : [];
      
      let flushSuccess = 0;
      for (const code of pendingScans) {
        try {
          await supabase.rpc('check_in_ticket' as any, { p_ticket_code: code });
          flushSuccess++;
        } catch (e) {
          console.error("Failed to sync ticket", code, e);
        }
      }
      
      // Clear queue if fully synced
      if (flushSuccess === pendingScans.length) {
        await AsyncStorage.setItem('@pending_offline_scans', JSON.stringify([]));
        setOfflinePendingCount(0);
      }

      // 2. Download fresh tickets
      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select('id, ticket_code, status, attendee_name, ticket_types(name), events!inner(organizer_id)')
        .eq('events.organizer_id', userData.user.id);
        
      if (error) throw error;
      
      await AsyncStorage.setItem('@offline_tickets', JSON.stringify(ticketsData || []));
      Alert.alert('Sync Complete', `Downloaded ${ticketsData?.length || 0} tickets for offline scanning.\nSynced ${flushSuccess} pending scans.`);
    } catch (err: any) {
      Alert.alert('Sync Error', err.message);
    } finally {
      setSyncing(false);
      checkPendingCount();
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setLoading(true);
    try {
      const { data: ticketResult, error } = await supabase.rpc('check_in_ticket' as any, {
        p_ticket_code: data
      });

      if (error) throw error;

      if (!ticketResult.success) {
        Alert.alert('Scan Failed', ticketResult.error || 'Unknown error', [
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
          'Success!', 
          `${ticketResult.attendee_name || 'Attendee'} (${ticketResult.ticket_name}) has been checked in successfully!`, 
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('network') || err.message?.toLowerCase().includes('fetch')) {
        // Handle Offline Scan
        try {
          const ticketsStr = await AsyncStorage.getItem('@offline_tickets');
          if (!ticketsStr) throw new Error("No offline data. Please connect to internet and sync first.");
          
          let offlineTickets = JSON.parse(ticketsStr);
          const ticketIndex = offlineTickets.findIndex((t: any) => t.id === data || t.ticket_code === data);
          
          if (ticketIndex === -1) {
            Alert.alert('Scan Failed (Offline)', 'Ticket not found in offline database.', [{ text: 'Try Again', onPress: () => setScanned(false) }]);
            return;
          }

          const ticket = offlineTickets[ticketIndex];
          if (ticket.status === 'scanned') {
            Alert.alert('Already Checked In (Offline)', `${ticket.attendee_name || 'Attendee'} was already checked in.`, [{ text: 'OK', onPress: () => setScanned(false) }]);
            return;
          }

          // Mark as scanned locally
          offlineTickets[ticketIndex].status = 'scanned';
          await AsyncStorage.setItem('@offline_tickets', JSON.stringify(offlineTickets));

          // Add to pending sync queue
          const pendingStr = await AsyncStorage.getItem('@pending_offline_scans');
          let pendingScans: string[] = pendingStr ? JSON.parse(pendingStr) : [];
          pendingScans.push(data);
          await AsyncStorage.setItem('@pending_offline_scans', JSON.stringify(pendingScans));
          setOfflinePendingCount(pendingScans.length);

          Alert.alert(
            'Success! (Offline)', 
            `${ticket.attendee_name || 'Attendee'} has been checked in offline. Will sync when internet is restored.`, 
            [{ text: 'OK', onPress: () => setScanned(false) }]
          );
        } catch (offlineErr: any) {
          Alert.alert('Scan Error', offlineErr.message, [{ text: 'Try Again', onPress: () => setScanned(false) }]);
        }
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
