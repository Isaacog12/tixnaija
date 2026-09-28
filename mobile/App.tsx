import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Alert, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// @ts-expect-error NativeWind css import
import './global.css';

import { supabase } from './supabase/client';
import { useVersionCheck } from './src/hooks/useVersionCheck';

// Auth Screens
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';

// Main Screens
import EventDetailScreen from './src/screens/EventDetailScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import EditEventScreen from './src/screens/EditEventScreen';

import DrawerNavigator from './src/navigation/DrawerNavigator';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [role, setRole] = useState<{ is_organizer: boolean; is_admin: boolean | null } | null>(null);
  const { hasUpdate, updateUrl } = useVersionCheck();

  const MainDrawer = React.useCallback((props: any) => <DrawerNavigator {...props} role={role} />, [role]);

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
      
      if (session?.user) {
        await fetchRole(session.user.id);
      } else {
        setIsInitializing(false);
      }
    };

    const fetchRole = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_organizer, is_admin')
          .eq('id', userId)
          .single();
        
        if (!error && data) {
          setRole(data);
        }
      } catch (err) {
        console.log('Error fetching role:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await fetchRole(session.user.id);
      } else {
        setRole(null);
        setIsInitializing(false);
      }
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
              <Stack.Screen name="MainDrawer" component={MainDrawer} options={{ headerShown: false }} />
              <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
              <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
              <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Create Event' }} />
              <Stack.Screen name="EditEvent" component={EditEventScreen} options={{ title: 'Edit Event' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
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
