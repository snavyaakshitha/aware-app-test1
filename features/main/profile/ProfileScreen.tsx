/**
 * Aware — Profile Screen — v4 design.
 * Flat cream background, no dark gradient header.
 * Avatar → plan card → stats row → health profile rows card.
 * All data logic unchanged.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, Radius, s } from '../../../shared/theme';
import type { ProfileStackParamList } from '../../../shared/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

// ─── Mock user data ───────────────────────────────────────────────────────────
const MOCK_USER = {
  name: 'Jamie D.',
  initials: 'JD',
  memberSince: 'April 2026',
  tier: 'free' as const,
  conditions: ['pcos', 'hypothyroidism'],
  allergens: ['gluten', 'dairy'],
  diets: ['gluten_free', 'dairy_free', 'anti_inflammatory'],
  avoids: ['seed_oils', 'hfcs', 'artificial_dyes', 'carrageenan'],
  stats: { scanned: 24, lists: 3, cleanAvg: 87 },
};

// ─── Health profile rows ──────────────────────────────────────────────────────
const HEALTH_ROWS = [
  { emoji: '❤️', label: 'Health Conditions', sub: 'PCOS, Hypothyroidism' },
  { emoji: '🌸', label: 'Allergies', sub: 'Gluten, Dairy' },
  { emoji: '🥗', label: 'Diet Preferences', sub: 'Gluten-free, Dairy-free' },
  { emoji: '🚫', label: 'Ingredients to Avoid', sub: 'Seed oils, HFCS, Artificial dyes' },
  { emoji: '🏠', label: 'Household Prefs', sub: 'Not set' },
];

// ─── ProfileScreen ────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.canvas} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + s(8), paddingBottom: insets.bottom + s(100) },
        ]}
      >
        {/* ── 3. Header row ─────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Profile</Text>
          <Pressable style={styles.settingsBtn}>
            <Feather name="settings" size={s(18)} color={Colors.textPrimary} />
          </Pressable>
        </View>

        {/* ── 4. Avatar section ─────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{MOCK_USER.initials}</Text>
          </View>
          <Text style={styles.userName}>{MOCK_USER.name}</Text>
          <Text style={styles.memberSince}>Member since {MOCK_USER.memberSince}</Text>
          <Pressable
            onPress={() => navigation.navigate('EditPreferences')}
            style={styles.editNameBtn}
          >
            <Feather name="edit-2" size={s(13)} color={Colors.textPrimary} />
            <Text style={styles.editNameText}>Edit name & photo</Text>
          </Pressable>
        </View>

        {/* ── 5. Plan card ──────────────────────────────────────────── */}
        <View style={styles.planCard}>
          <Text style={styles.planEmoji}>🌱</Text>
          <View style={styles.planText}>
            <Text style={styles.planTitle}>Free Plan</Text>
            <Text style={styles.planSub}>Pay what you like · $30/year</Text>
          </View>
          <View style={styles.upgradeChip}>
            <Text style={styles.upgradeChipText}>Upgrade</Text>
          </View>
        </View>

        {/* ── 6. Stats row ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          {[
            { value: '24', label: 'Scans' },
            { value: '3', label: 'Lists' },
            { value: '87', label: 'Score' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── 7. Health profile section ─────────────────────────────── */}
        <View style={styles.healthSection}>
          {/* Section header */}
          <View style={styles.healthHeaderRow}>
            <View>
              <Text style={styles.healthTitle}>Health profile</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('EditPreferences')}
              style={styles.editAllBtn}
            >
              <Text style={styles.editAllText}>Edit all</Text>
            </Pressable>
          </View>
          <Text style={styles.healthSub}>
            Your profile personalizes scan results and recommendations.
          </Text>

          {/* Rows card */}
          <View style={styles.healthRowsCard}>
            {HEALTH_ROWS.map((row, index) => (
              <React.Fragment key={row.label}>
                <Pressable style={styles.healthRow}>
                  <View style={styles.healthRowIcon}>
                    <Text style={styles.healthRowEmoji}>{row.emoji}</Text>
                  </View>
                  <View style={styles.healthRowText}>
                    <Text style={styles.healthRowLabel}>{row.label}</Text>
                    <Text style={styles.healthRowSub} numberOfLines={1}>
                      {row.sub}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={s(16)} color="#C0C0BC" />
                </Pressable>
                {index < HEALTH_ROWS.length - 1 && <View style={styles.rowDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Sign out ──────────────────────────────────────────────── */}
        <Pressable style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.versionText}>Aware v0.1.0 · Built with 💚</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scroll: {
    paddingHorizontal: s(20),
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(12),
  },
  screenTitle: {
    fontSize: s(22),
    fontWeight: '800',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
  },
  settingsBtn: {
    width: s(38),
    height: s(38),
    borderRadius: Radius.pill,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0DC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Avatar section
  avatarSection: {
    alignItems: 'center',
    paddingTop: s(12),
    paddingBottom: s(20),
  },
  avatarCircle: {
    width: s(80),
    height: s(80),
    borderRadius: s(40),
    backgroundColor: '#EEF2EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    marginBottom: s(12),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  avatarInitials: {
    fontSize: s(24),
    fontWeight: '800',
    color: Colors.accent,
    fontFamily: Font.bold,
  },
  userName: {
    fontSize: s(22),
    fontWeight: '800',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
    marginBottom: s(4),
  },
  memberSince: {
    fontSize: s(13),
    color: Colors.textTertiary,
    fontFamily: Font.regular,
    marginBottom: s(12),
  },
  editNameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0DC',
    borderRadius: Radius.pill,
    paddingHorizontal: s(14),
    paddingVertical: s(7),
  },
  editNameText: {
    fontSize: s(13),
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: Font.medium,
  },

  // Plan card
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: Radius.xl,
    paddingVertical: s(14),
    paddingHorizontal: s(16),
    marginBottom: s(16),
    borderWidth: 1,
    borderColor: '#E8E8E4',
    gap: s(10),
  },
  planEmoji: { fontSize: s(20) },
  planText: { flex: 1 },
  planTitle: {
    fontSize: s(15),
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
  },
  planSub: {
    fontSize: s(12),
    color: Colors.textSecondary,
    fontFamily: Font.regular,
    marginTop: s(1),
  },
  upgradeChip: {
    backgroundColor: Colors.tealLight,
    borderRadius: Radius.pill,
    paddingHorizontal: s(12),
    paddingVertical: s(6),
  },
  upgradeChipText: {
    fontSize: s(13),
    fontWeight: '600',
    color: Colors.accent,
    fontFamily: Font.medium,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: s(10),
    marginBottom: s(20),
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: s(18),
    paddingVertical: s(14),
    paddingHorizontal: s(10),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E4',
  },
  statValue: {
    fontSize: s(17),
    fontWeight: '800',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
    marginBottom: s(3),
  },
  statLabel: {
    fontSize: s(11),
    color: Colors.textSecondary,
    fontFamily: Font.regular,
  },

  // Health profile section
  healthSection: {
    marginBottom: s(24),
  },
  healthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(4),
  },
  healthTitle: {
    fontSize: s(17),
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: Font.bold,
  },
  editAllBtn: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: s(12),
    paddingVertical: s(5),
  },
  editAllText: {
    fontSize: s(13),
    fontWeight: '600',
    color: Colors.accent,
    fontFamily: Font.medium,
  },
  healthSub: {
    fontSize: s(12),
    color: Colors.textSecondary,
    fontFamily: Font.regular,
    marginBottom: s(12),
    lineHeight: s(18),
  },
  healthRowsCard: {
    backgroundColor: 'white',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    overflow: 'hidden',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(12),
    paddingHorizontal: s(14),
    gap: s(12),
  },
  healthRowIcon: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    backgroundColor: Colors.canvas2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthRowEmoji: { fontSize: s(18) },
  healthRowText: { flex: 1 },
  healthRowLabel: {
    fontSize: s(14),
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: Font.medium,
  },
  healthRowSub: {
    fontSize: s(12),
    color: Colors.textSecondary,
    fontFamily: Font.regular,
    marginTop: s(1),
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.canvas2,
    marginHorizontal: s(14),
  },

  // Sign out
  signOutBtn: {
    alignSelf: 'center',
    paddingVertical: s(12),
    paddingHorizontal: s(32),
    marginBottom: s(8),
  },
  signOutText: {
    fontSize: s(15),
    color: Colors.danger,
    fontFamily: Font.regular,
  },
  versionText: {
    fontSize: s(12),
    color: Colors.textTertiary,
    textAlign: 'center',
    fontFamily: Font.regular,
    paddingBottom: s(8),
  },
});
