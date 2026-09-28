import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Home, Ticket, Settings as SettingsIcon, Calendar, QrCode, ShieldAlert } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import HomeScreen from '../screens/HomeScreen';
import MyTicketsScreen from '../screens/MyTicketsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MyEventsScreen from '../screens/MyEventsScreen';
import AdminScreen from '../screens/AdminScreen';
import ScanTicketsScreen from '../screens/ScanTicketsScreen';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props: any) {
  const { role, ...restProps } = props;
  const isOrganizer = role?.is_organizer || false;
  const isAdmin = role?.is_admin || false;

  return (
    <DrawerContentScrollView {...restProps} style={styles.drawerContainer}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Attendee</Text>
        <DrawerItem
          label="Home"
          icon={({ color, size }) => <Home color={color} size={size} />}
          onPress={() => props.navigation.navigate('HomeDrawer')}
          activeTintColor="#f2611e"
          inactiveTintColor="#f4f2f0"
        />
        <DrawerItem
          label="My Tickets"
          icon={({ color, size }) => <Ticket color={color} size={size} />}
          onPress={() => props.navigation.navigate('MyTickets')}
          activeTintColor="#f2611e"
          inactiveTintColor="#f4f2f0"
        />
        <DrawerItem
          label="Settings"
          icon={({ color, size }) => <SettingsIcon color={color} size={size} />}
          onPress={() => props.navigation.navigate('Settings')}
          activeTintColor="#f2611e"
          inactiveTintColor="#f4f2f0"
        />
      </View>

      {isOrganizer && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Organizer</Text>
          <DrawerItem
            label="My Events"
            icon={({ color, size }) => <Calendar color={color} size={size} />}
            onPress={() => props.navigation.navigate('MyEvents')}
            activeTintColor="#f2611e"
            inactiveTintColor="#f4f2f0"
          />
          <DrawerItem
            label="Scan Tickets"
            icon={({ color, size }) => <QrCode color={color} size={size} />}
            onPress={() => props.navigation.navigate('ScanTickets')}
            activeTintColor="#f2611e"
            inactiveTintColor="#f4f2f0"
          />
        </View>
      )}

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Admin</Text>
          <DrawerItem
            label="Admin Dashboard"
            icon={({ color, size }) => <ShieldAlert color={color} size={size} />}
            onPress={() => props.navigation.navigate('Admin')}
            activeTintColor="#f2611e"
            inactiveTintColor="#f4f2f0"
          />
        </View>
      )}
    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator({ role }: { role: { is_organizer: boolean; is_admin: boolean | null } | null }) {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} role={role} />}
      screenOptions={{
        headerTransparent: true,
        headerBackground: () => (
          <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        drawerStyle: {
          backgroundColor: '#000000',
        },
      }}
    >
      <Drawer.Screen name="HomeDrawer" component={HomeScreen} options={{ title: 'Events', headerShown: false }} />
      <Drawer.Screen name="MyTickets" component={MyTicketsScreen} options={{ title: 'My Tickets' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      {role?.is_organizer && (
        <>
          <Drawer.Screen name="MyEvents" component={MyEventsScreen} options={{ title: 'My Events' }} />
          <Drawer.Screen name="ScanTickets" component={ScanTicketsScreen} options={{ title: 'Scan Tickets' }} />
        </>
      )}
      {role?.is_admin && (
        <Drawer.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />
      )}
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: '#22201e',
  },
  section: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 10,
  },
  sectionHeader: {
    color: '#8e8b85',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 10,
  },
});
