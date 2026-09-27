import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Alert, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import './global.css';

import { supabase } from './supabase/client';
import { useVersionCheck } from './src/hooks/useVersionCheck';

// Auth Screens
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';

// Main Screens
import HomeScreen from './src/screens/HomeScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MyTicketsScreen from './src/screens/MyTicketsScreen';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Ticket, Settings as SettingsIcon } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#22201e' },
        headerTintColor: '#f4f2f0',
        tabBarStyle: {
          backgroundColor: '#22201e',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
        },
        tabBarActiveTintColor: '#f2611e',
        tabBarInactiveTintColor: '#c2bdb8',
      }}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{ 
          title: 'Events',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }} 
      />
      <Tab.Screen 
        name="MyTickets" 
        component={MyTicketsScreen} 
        options={{ 
          title: 'My Tickets',
          tabBarIcon: ({ color, size }) => <Ticket color={color} size={size} />
        }} 
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ 
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />
        }} 
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { hasUpdate, updateUrl } = useVersionCheck();

  useEffect(() => {
    // Check for updates
    if (hasUpdate && updateUrl) {
      Alert.alert(
        "Update Available", 
        "A new version of the app is available.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Download", onPress: () => Linking.openURL(updateUrl) }
        ]
      );
    }
  }, [hasUpdate, updateUrl]);

  useEffect(() => {
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsInitializing(false);
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f2611e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{
          headerStyle: { backgroundColor: '#22201e' },
          headerTintColor: '#f4f2f0',
        }}
      >
        {!session ? (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          </>
        ) : (
          // Main Stack (Tabs + Modals/Details)
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#22201e',
    alignItems: 'center',
    justifyContent: 'center',
  }
});
