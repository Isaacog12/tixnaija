import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdminScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Admin Area</Text>
        <Text style={styles.subtitle}>This section is under construction. It will contain global platform settings, user management, and payout approvals.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#22201e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    backgroundColor: '#2c2a28',
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4f2f0',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#8e8b85',
    textAlign: 'center',
    lineHeight: 24,
  },
});
