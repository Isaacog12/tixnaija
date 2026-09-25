import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { supabase } from '../../supabase/client';

export default function SettingsScreen({ navigation }: any) {
  const { checkVersion } = useVersionCheck();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error logging out', error.message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Settings</Text>
      
      {/* Update Check Button */}
      <TouchableOpacity 
        style={styles.buttonOutline}
        onPress={() => checkVersion(true)}
      >
        <Text style={styles.buttonTextOutline}>Check for Updates</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity 
        style={[styles.buttonOutline, { borderColor: '#e55a5a', marginTop: 32 }]}
        onPress={handleLogout}
      >
        <Text style={[styles.buttonTextOutline, { color: '#e55a5a' }]}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'var(--background)', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'var(--foreground)', marginBottom: 24 },
  buttonOutline: {
    borderColor: 'var(--primary)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonTextOutline: { color: 'var(--primary)', fontWeight: 'bold', fontSize: 16 }
});
