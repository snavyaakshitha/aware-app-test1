/**
 * Aware — MainNavigator
 * Bottom tab navigator: Home | Search | Scan (center) | Awarenews | Profile
 * v4 design: 5 tabs, teal accent, center scan button raised -20.
 */
import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';

import { Colors, s } from '../../shared/theme';
import type {
  HomeStackParamList,
  ScannerStackParamList,
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


// Profile stack
import ProfileScreen from './profile/ProfileScreen';
import EditPreferencesScreen from './profile/EditPreferencesScreen';

// Awarenews
import AwarenewsScreen from './news/AwarenewsScreen';

// ─── Stack navigators ──────────────────────────────────────────────────────────
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ScannerStack = createNativeStackNavigator<ScannerStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const SearchStack = createNativeStackNavigator<HomeStackParamList>();
const AwarenewsStack = createNativeStackNavigator();

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

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen
        name="Home"
        component={HomeScreen}
        initialParams={undefined}
      />
      <SearchStack.Screen name="Store" component={StoreScreen} />
      <SearchStack.Screen name="SearchResults" component={SearchResultsScreen} />
      <SearchStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </SearchStack.Navigator>
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

function AwarenewsStackNavigator() {
  return (
    <AwarenewsStack.Navigator screenOptions={{ headerShown: false }}>
      <AwarenewsStack.Screen name="Awarenews" component={AwarenewsScreen} />
    </AwarenewsStack.Navigator>
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
          backgroundColor: 'white',
          borderTopColor: 'rgba(0,0,0,0.07)',
          borderTopWidth: 1,
          height: s(84),
          paddingBottom: s(16),
          paddingTop: s(8),
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 20,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: '#8C9299',
        tabBarLabelStyle: {
          fontSize: s(11),
          fontWeight: '500',
          marginTop: s(2),
        },
      }}
    >
      {/* 1 — Home */}
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <Feather name="home" color={color} size={s(22)} />
          ),
        }}
      />

      {/* 2 — Search */}
      <Tab.Screen
        name="SearchTab"
        component={SearchStackNavigator}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color }) => (
            <Feather name="search" color={color} size={s(22)} />
          ),
        }}
      />

      {/* 3 — Scan (center, raised) */}
      <Tab.Screen
        name="ScanTab"
        component={ScannerStackNavigator}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: s(56),
                height: s(56),
                borderRadius: s(999),
                backgroundColor: Colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -s(20),
              }}
            >
              <Ionicons name="barcode-outline" color="white" size={s(24)} />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: s(11),
            fontWeight: '500',
            color: Colors.accent,
            marginTop: s(2),
          },
        }}
      />

      {/* 4 — Awarenews */}
      <Tab.Screen
        name="AwarenewsTab"
        component={AwarenewsStackNavigator}
        options={{
          tabBarLabel: 'Awarenews',
          tabBarIcon: ({ color }) => (
            <Feather name="file-text" color={color} size={s(22)} />
          ),
        }}
      />

      {/* 5 — Profile */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Feather name="user" color={color} size={s(22)} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
