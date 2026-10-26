import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Ticket, Calendar, QrCode, Settings } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useAuth } from '../../src/context/AuthContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isOrganizer, isAdmin } = useAuth();
  const canScan = isOrganizer || isAdmin;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'android' ? 64 + insets.bottom : 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: isOrganizer ? 'My Events' : 'My Tickets',
          tabBarIcon: ({ color, size }) =>
            isOrganizer ? (
              <Calendar size={size} color={color} />
            ) : (
              <Ticket size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Gate Scan',
          href: canScan ? '/(tabs)/scan' : null,
          tabBarIcon: ({ color, size }) => <QrCode size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
