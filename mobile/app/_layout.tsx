import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';
import { colors } from '../src/theme/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 3, // 3 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" backgroundColor={colors.background} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="e/[slug]" options={{ headerShown: false }} />
              <Stack.Screen name="checkout/[eventId]" options={{ headerShown: false }} />
              <Stack.Screen name="order/[orderId]" options={{ headerShown: false }} />
              <Stack.Screen name="ticket/[ticketCode]" options={{ headerShown: false }} />
              <Stack.Screen name="box-office/[slug]" options={{ headerShown: false }} />
              <Stack.Screen name="events/create" options={{ headerShown: false }} />
              <Stack.Screen name="events/[id]/edit" options={{ headerShown: false }} />
              <Stack.Screen name="events/[id]/broadcast" options={{ headerShown: false }} />
              <Stack.Screen name="events/[id]/attendees" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
