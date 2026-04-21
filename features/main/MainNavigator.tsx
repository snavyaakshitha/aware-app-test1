/**
 * Aware — MainNavigator
 * Bottom tab navigator: Home | Scan | Lists | Profile
 * Each tab has its own native stack navigator.
 */
import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';

import { Colors, s, Radius } from '../../shared/theme';
import type {
  HomeStackParamList,
  ScannerStackParamList,
  ListsStackParamList,
  ProfileStackParamList,
} from '../../shared/types';

// Home stack
import HomeScreen from './home/HomeScreen';
import StoreScreen from './home/StoreScreen';
import SearchResultsScreen from './home/SearchResultsScreen';
import ProductDetailScreen from './home/ProductDetailScreen';

// Scanner stack
import ScannerScreen from './scanner/ScannerScreen';
import ScanResultScreen from './scanner/ScanResultScreen';
import AIFallbackScreen from './scanner/AIFallbackScreen';

// Lists stack
import ListsScreen from './lists/ListsScreen';
import ListDetailScreen from './lists/ListDetailScreen';

// Profile stack
import ProfileScreen from './profile/ProfileScreen';
import EditPreferencesScreen from './profile/EditPreferencesScreen';

// ─── Stack navigators ──────────────────────────────────────────────────────────
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ScannerStack = createNativeStackNavigator<ScannerStackParamList>();
const ListsStack = createNativeStackNavigator<ListsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Store" component={StoreScreen} />
      <HomeStack.Screen name="SearchResults" component={SearchResultsScreen} />
      <HomeStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </HomeStack.Navigator>
  );
}

function ScannerStackNavigator() {
  return (
    <ScannerStack.Navigator screenOptions={{ headerShown: false }}>
      <ScannerStack.Screen name="Scanner" component={ScannerScreen} />
      <ScannerStack.Screen name="ScanResult" component={ScanResultScreen} />
      <ScannerStack.Screen name="AIFallback" component={AIFallbackScreen} />
    </ScannerStack.Navigator>
  );
}

function ListsStackNavigator() {
  return (
    <ListsStack.Navigator screenOptions={{ headerShown: false }}>
      <ListsStack.Screen name="Lists" component={ListsScreen} />
      <ListsStack.Screen name="ListDetail" component={ListDetailScreen} />
    </ListsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="EditPreferences" component={EditPreferencesScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab navigator ─────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.canvasDark,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: s(80),
          paddingBottom: s(12),
          paddingTop: s(6),
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarLabelStyle: {
          fontSize: s(11),
          fontWeight: '500',
          marginTop: s(2),
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size ?? s(22)} />
          ),
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScannerStackNavigator}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: s(48),
                height: s(48),
                borderRadius: Radius.pill,
                backgroundColor: focused ? Colors.accent : Colors.canvasMid,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: s(8),
                borderWidth: focused ? 0 : 1,
                borderColor: Colors.border,
              }}
            >
              <Ionicons
                name="barcode-outline"
                color={focused ? Colors.canvasDark : color}
                size={s(24)}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ListsTab"
        component={ListsStackNavigator}
        options={{
          tabBarLabel: 'Lists',
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" color={color} size={size ?? s(22)} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" color={color} size={size ?? s(22)} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
