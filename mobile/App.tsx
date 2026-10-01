import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './global.css';

import { supabase } from './supabase/client';
import { useVersionCheck } from './src/hooks/useVersionCheck';
import { BlurView } from 'expo-blur';

// Auth Screens
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';

// Main Screens
import EventDetailScreen from './src/screens/EventDetailScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import EditEventScreen from './src/screens/EditEventScreen';
import BoxOfficeScreen from './src/screens/BoxOfficeScreen';
import AdminOrganizerAppsScreen from './src/screens/AdminOrganizerAppsScreen';
import AdminJobAppsScreen from './src/screens/AdminJobAppsScreen';
import AdminBannersScreen from './src/screens/AdminBannersScreen';

import TabNavigator from './src/navigation/TabNavigator';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [role, setRole] = useState<{ is_organizer: boolean; is_admin: boolean | null; is_staff?: boolean } | null>(null);
  const { hasUpdate } = useVersionCheck();

  const MainTabs = React.useCallback((props: any) => <TabNavigator {...props} role={role} />, [role]);

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
          
        const { data: staffData } = await (supabase
          .from('event_staff' as any)
          .select('id') as any)
          .eq('user_id', userId)
          .limit(1);
        
        if (!error && data) {
          setRole({ 
            is_organizer: data.is_organizer, 
            is_admin: data.is_admin, 
            is_staff: (staffData && staffData.length > 0) 
          });
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

  const linking = {
    prefixes: [Linking.createURL('/'), 'https://tixnaija.name.ng'],
    config: {
      screens: {
        MainTabs: {
          screens: {
            Home: 'home',
            Scan: 'scan',
            MyEvents: 'myevents',
            Settings: 'settings',
          },
        },
        EventDetail: 'e/:slug',
      },
    },
  } as any;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer linking={linking}>
        <Stack.Navigator 
          screenOptions={{
            headerTransparent: true,
            headerBackground: () => (
              <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
            ),
            headerTintColor: '#ffffff',
            headerTitleStyle: {
              fontWeight: '600',
            },
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
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
              <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
              <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Create Event' }} />
              <Stack.Screen name="EditEvent" component={EditEventScreen} options={{ title: 'Edit Event' }} />
              <Stack.Screen name="BoxOffice" component={BoxOfficeScreen} options={{ title: 'Box Office' }} />
              <Stack.Screen name="AdminOrganizerApps" component={AdminOrganizerAppsScreen} options={{ title: 'Organizer Applications' }} />
              <Stack.Screen name="AdminJobApps" component={AdminJobAppsScreen} options={{ title: 'Job Applications' }} />
              <Stack.Screen name="AdminBanners" component={AdminBannersScreen} options={{ title: 'Home Banners' }} />
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
