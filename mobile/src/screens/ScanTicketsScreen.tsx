import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { supabase } from '../../supabase/client';

export default function ScanTicketsScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

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
      Alert.alert('Scan Error', err.message, [
        { text: 'Try Again', onPress: () => setScanned(false) }
      ]);
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

      <View style={styles.instructions}>
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
  }
});
