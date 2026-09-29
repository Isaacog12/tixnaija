import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Calendar, QrCode, ShieldAlert, MoreHorizontal, Ticket, Search } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

import HomeScreen from '../screens/HomeScreen';
import MyEventsScreen from '../screens/MyEventsScreen';
import MyTicketsScreen from '../screens/MyTicketsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanTicketsScreen from '../screens/ScanTicketsScreen';
import AdminScreen from '../screens/AdminScreen';

const Tab = createBottomTabNavigator();

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabNavigator({ role }: { role: { is_organizer: boolean; is_admin: boolean | null } | null }) {
  const isOrganizer = role?.is_organizer || false;
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerTransparent: true,
        headerBackground: () => (
          <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(255, 255, 255, 0.15)',
          elevation: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarBackground: () => (
          <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: '#2ED573', // Cyan/Green from mockup
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{ 
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> 
        }} 
      />
      
      {isOrganizer ? (
        <Tab.Screen 
          name="Events" 
          component={MyEventsScreen} 
          options={{ 
            tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> 
          }} 
        />
      ) : (
        <Tab.Screen 
          name="Tickets" 
          component={MyTicketsScreen} 
          options={{ 
            tabBarIcon: ({ color, size }) => <Ticket color={color} size={size} /> 
          }} 
        />
      )}

      {isOrganizer && (
        <Tab.Screen 
          name="Scan" 
          component={ScanTicketsScreen} 
          options={{ 
            title: 'Scan',
            tabBarIcon: ({ color, size }) => <QrCode color={color} size={size} /> 
          }} 
        />
      )}

      {role?.is_admin && (
        <Tab.Screen 
          name="Admin" 
          component={AdminScreen} 
          options={{ 
            tabBarIcon: ({ color, size }) => <ShieldAlert color={color} size={size} /> 
          }} 
        />
      )}

      <Tab.Screen 
        name="More" 
        component={SettingsScreen} 
        options={{ 
          title: 'More',
          tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> 
        }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#000000', // true black for iOS
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#8e8b85',
    textAlign: 'center',
  },
});
