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

const Stack = createNativeStackNavigator();

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
          // Main Stack
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'TixNaija' }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="MyTickets" component={MyTicketsScreen} options={{ title: 'My Tickets' }} />
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
