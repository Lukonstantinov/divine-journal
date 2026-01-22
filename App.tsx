import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { EditNoteScreen } from './src/screens/EditNoteScreen';
import { getDatabase } from './src/lib/database';
import { 
  addNotificationResponseListener, 
  removeNotificationListener,
  requestPermissions,
  isNotificationsAvailable,
} from './src/lib/notifications';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          height: 65 + Math.max(insets.bottom, 12),
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📖</Text>,
          tabBarLabel: 'Notes',
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>📅</Text>,
          tabBarLabel: 'Calendar',
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>🔍</Text>,
          tabBarLabel: 'Search',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text>,
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const [isReady, setIsReady] = useState(false);
  const navigationRef = React.useRef<any>(null);

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
        if (isNotificationsAvailable()) {
          await requestPermissions();
        }
        setIsReady(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setIsReady(true);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!isNotificationsAvailable()) return;
    
    const subscription = addNotificationResponseListener(response => {
      const noteId = response?.notification?.request?.content?.data?.noteId;
      if (noteId && navigationRef.current) {
        navigationRef.current.navigate('EditNote', { noteId });
      }
    });

    return () => {
      if (subscription) {
        removeNotificationListener(subscription);
      }
    };
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={{ marginTop: 16, color: '#666' }}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="EditNote" component={EditNoteScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}



