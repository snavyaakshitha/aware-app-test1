/**
 * Aware — Profile Screen
 *
 * User's health profile, membership, stats, settings, legal.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, s, Radius, scoreColor } from '../../../shared/theme';
import {
  HEALTH_CONDITION_OPTIONS,
  ALLERGEN_OPTIONS,
  DIET_OPTIONS,
  INGREDIENT_AVOID_OPTIONS,
} from '../../../shared/mockData';
import type { ProfileStackParamList } from '../../../shared/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

// ─── Mock user data ───────────────────────────────────────────────────────────
const MOCK_USER = {
  name: 'Jamie D.',
  memberSince: 'April 2026',
  tier: 'free' as const,
  conditions: ['pcos', 'hypothyroidism'],
  allergens: ['gluten', 'dairy'],
  diets: ['gluten_free', 'dairy_free', 'anti_inflammatory'],
  avoids: ['seed_oils', 'hfcs', 'artificial_dyes', 'carrageenan'],
  stats: { scanned: 24, lists: 3, cleanAvg: 87 },
};

function ExpandableSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={exStyles.section}>
      <Pressable onPress={() => setOpen(v => !v)} style={exStyles.sectionHeader}>
        <Text style={exStyles.sectionTitle}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <View style={exStyles.countBadge}>
            <Text style={exStyles.countText}>{count}</Text>
          </View>
          <Feather
            name={open ? 'chevron-up' : 'chevron-down'}
            size={s(18)}
            color={Colors.textMuted}
          />
        </View>
      </Pressable>
      {open && <View style={exStyles.sectionBody}>{children}</View>}
    </View>
  );
}

const exStyles = StyleSheet.create({
  section: {
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(14),
    paddingHorizontal: s(16),
  },
  sectionTitle: {
    fontFamily: Font.medium,
    fontWeight: '500',
    fontSize: s(15),
    color: Colors.textOffWhite,
  },
  countBadge: {
    backgroundColor: 'rgba(139,197,61,0.15)',
    borderRadius: Radius.pill,
    paddingHorizontal: s(8),
    paddingVertical: s(2),
  },
  countText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(12),
    color: Colors.accent,
  },
  sectionBody: {
    paddingHorizontal: s(16),
    paddingBottom: s(12),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(6),
  },
});

function Chip({ label, emoji }: { label: string; emoji?: string }) {
  return (
    <View style={chipStyles.chip}>
      {emoji && <Text style={{ fontSize: s(13) }}>{emoji}</Text>}
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: 'rgba(139,197,61,0.1)',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.25)',
    paddingHorizontal: s(10),
    paddingVertical: s(5),
  },
  label: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.accent,
  },
});

function SettingsRow({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  danger?: boolean;
}) {
  return (
    <Pressable style={settingStyles.row}>
      <View style={settingStyles.iconBox}>{icon}</View>
      <Text style={[settingStyles.label, danger && { color: Colors.danger }]}>{label}</Text>
      <View style={settingStyles.right}>
        {value && <Text style={settingStyles.value}>{value}</Text>}
        {!danger && <Feather name="chevron-right" size={s(16)} color={Colors.textFaint} />}
      </View>
    </Pressable>
  );
}

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(16),
    paddingVertical: s(13),
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  iconBox: { width: s(32), marginRight: s(12) },
  label: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: s(15),
    color: Colors.textOffWhite,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  value: {
    fontFamily: Font.regular,
    fontSize: s(14),
    color: Colors.textMuted,
  },
});

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const conditionLabels = MOCK_USER.conditions.map(id =>
    HEALTH_CONDITION_OPTIONS.find(o => o.id === id)
  ).filter(Boolean) as typeof HEALTH_CONDITION_OPTIONS;

  const allergenLabels = MOCK_USER.allergens.map(id =>
    ALLERGEN_OPTIONS.find(o => o.id === id)
  ).filter(Boolean) as typeof ALLERGEN_OPTIONS;

  const dietLabels = MOCK_USER.diets.map(id =>
    DIET_OPTIONS.find(o => o.id === id)
  ).filter(Boolean) as typeof DIET_OPTIONS;

  const avoidLabels = MOCK_USER.avoids.map(id =>
    INGREDIENT_AVOID_OPTIONS.find(o => o.id === id)
  ).filter(Boolean) as typeof INGREDIENT_AVOID_OPTIONS;

  return (
    <View style={styles.root}>
      <View style={styles.ellipse1} />
      <View style={styles.ellipse5} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header space */}
        <View style={{ height: insets.top + s(12) }} />

        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>JD</Text>
          </View>
          <Text style={styles.userName}>{MOCK_USER.name}</Text>
          <Text style={styles.memberSince}>Member since {MOCK_USER.memberSince}</Text>
          <Pressable
            onPress={() => navigation.navigate('EditPreferences')}
            style={styles.editBtn}
          >
            <Feather name="edit-2" size={s(13)} color={Colors.textDark} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Membership card */}
        <View style={styles.memberCard}>
          <View style={styles.memberLeft}>
            <Text style={styles.memberTier}>
              {MOCK_USER.tier === 'free' ? '🌱 Free Plan' : '💚 Supporter'}
            </Text>
            <Text style={styles.memberDesc}>
              Pay what you like · $30/year · Free trial
            </Text>
          </View>
          <Pressable style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Upgrade →</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Scanned', value: MOCK_USER.stats.scanned, icon: '📦' },
            { label: 'Lists', value: MOCK_USER.stats.lists, icon: '📋' },
            { label: 'Avg Score', value: MOCK_USER.stats.cleanAvg, icon: '🌿' },
          ].map(stat => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statEmoji}>{stat.icon}</Text>
              <Text style={[styles.statValue, stat.label === 'Avg Score' && { color: scoreColor(stat.value) }]}>
                {stat.value}{stat.label === 'Avg Score' ? '/100' : ''}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Preferences card */}
        <View style={styles.prefCard}>
          <View style={styles.prefHeader}>
            <Text style={styles.prefTitle}>My Health Profile</Text>
            <Pressable onPress={() => navigation.navigate('EditPreferences')}>
              <Text style={styles.editLink}>Edit →</Text>
            </Pressable>
          </View>

          <ExpandableSection title="Health Conditions" count={conditionLabels.length}>
            {conditionLabels.map(c => (
              <Chip key={c.id} label={c.label} emoji={c.emoji} />
            ))}
          </ExpandableSection>

          <ExpandableSection title="Allergens" count={allergenLabels.length}>
            {allergenLabels.map(a => (
              <Chip key={a.id} label={a.label} emoji={a.emoji} />
            ))}
          </ExpandableSection>

          <ExpandableSection title="Diet Preferences" count={dietLabels.length}>
            {dietLabels.map(d => (
              <Chip key={d.id} label={d.label} emoji={(d as any).emoji} />
            ))}
          </ExpandableSection>

          <ExpandableSection title="Ingredients to Avoid" count={avoidLabels.length}>
            {avoidLabels.map(a => (
              <Chip key={a.id} label={a.label} emoji={a.emoji} />
            ))}
          </ExpandableSection>
        </View>

        {/* Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsHeader}>Settings</Text>
          <SettingsRow
            icon={<Ionicons name="notifications-outline" size={s(18)} color={Colors.textMuted} />}
            label="Notifications"
            value="On"
          />
          <SettingsRow
            icon={<Feather name="map-pin" size={s(18)} color={Colors.textMuted} />}
            label="Location"
            value="San Francisco, CA"
          />
          <SettingsRow
            icon={<Feather name="moon" size={s(18)} color={Colors.textMuted} />}
            label="Appearance"
            value="Dark"
          />
          <SettingsRow
            icon={<Feather name="globe" size={s(18)} color={Colors.textMuted} />}
            label="Language"
            value="English"
          />
          <SettingsRow
            icon={<Feather name="shield" size={s(18)} color={Colors.textMuted} />}
            label="Data & Privacy"
          />
          <SettingsRow
            icon={<Feather name="help-circle" size={s(18)} color={Colors.textMuted} />}
            label="Help & Feedback"
          />
          <SettingsRow
            icon={<Ionicons name="star-outline" size={s(18)} color={Colors.textMuted} />}
            label="Rate Aware ⭐"
          />
        </View>

        {/* Legal */}
        <View style={styles.legalCard}>
          <Text style={styles.settingsHeader}>Legal</Text>
          <SettingsRow
            icon={<Feather name="file-text" size={s(18)} color={Colors.textMuted} />}
            label="Terms of Service"
          />
          <SettingsRow
            icon={<Feather name="lock" size={s(18)} color={Colors.textMuted} />}
            label="Privacy Policy"
          />
          <View style={styles.disclaimer}>
            <Feather name="alert-circle" size={s(14)} color={Colors.textMuted} />
            <Text style={styles.disclaimerText}>
              Aware recommendations are based on preferences you set in this app.
              Always consult a qualified healthcare professional for medical advice.
              Results may vary based on profile settings.
            </Text>
          </View>
        </View>

        {/* Sign out */}
        <Pressable style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.versionText}>Aware v0.1.0 · Built with 💚</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas, overflow: 'hidden' },
  ellipse1: {
    position: 'absolute', width: s(583), height: s(770), borderRadius: s(400),
    backgroundColor: '#79FFA8', top: s(80), left: s(-50),
    ...Platform.select({ web: { filter: `blur(${s(400)}px)` } as any }),
  },
  ellipse5: {
    position: 'absolute', width: s(1034), height: s(1055), borderRadius: s(530),
    backgroundColor: Colors.canvasDark, top: s(-450), left: s(-400),
    ...Platform.select({ web: { filter: `blur(${s(60)}px)` } as any }),
  },

  avatarSection: {
    alignItems: 'center',
    paddingTop: s(8),
    paddingBottom: s(20),
  },
  avatarCircle: {
    width: s(72),
    height: s(72),
    borderRadius: s(36),
    backgroundColor: 'rgba(139,197,61,0.2)',
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(12),
  },
  avatarInitials: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(24),
    color: Colors.accent,
  },
  userName: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(22),
    color: Colors.textWhite,
    marginBottom: s(4),
  },
  memberSince: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    marginBottom: s(12),
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: s(14),
    paddingVertical: s(7),
  },
  editBtnText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(13),
    color: Colors.textDark,
  },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: s(16),
    marginBottom: s(16),
    backgroundColor: Colors.canvasMid,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.25)',
    padding: s(16),
    gap: s(12),
  },
  memberLeft: { flex: 1 },
  memberTier: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(15),
    color: Colors.textWhite,
    marginBottom: s(3),
  },
  memberDesc: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
  },
  upgradeBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: s(14),
    paddingVertical: s(8),
  },
  upgradeBtnText: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(13),
    color: Colors.textDark,
  },

  statsRow: {
    flexDirection: 'row',
    gap: s(8),
    marginHorizontal: s(16),
    marginBottom: s(16),
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(2,47,19,0.2)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: s(12),
    alignItems: 'center',
  },
  statEmoji: { fontSize: s(20), marginBottom: s(4) },
  statValue: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(18),
    color: Colors.textWhite,
  },
  statLabel: {
    fontFamily: Font.regular,
    fontSize: s(11),
    color: Colors.textMuted,
    marginTop: s(2),
  },

  prefCard: {
    marginHorizontal: s(16),
    marginBottom: s(16),
    backgroundColor: 'rgba(2,47,19,0.2)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingVertical: s(14),
    borderBottomWidth: 1,
    borderColor: Colors.divider,
  },
  prefTitle: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(16),
    color: Colors.textWhite,
  },
  editLink: {
    fontFamily: Font.medium,
    fontWeight: '500',
    fontSize: s(13),
    color: Colors.accent,
  },

  settingsCard: {
    marginHorizontal: s(16),
    marginBottom: s(16),
    backgroundColor: 'rgba(2,47,19,0.2)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  legalCard: {
    marginHorizontal: s(16),
    marginBottom: s(16),
    backgroundColor: 'rgba(2,47,19,0.2)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingsHeader: {
    fontFamily: Font.bold,
    fontWeight: '700',
    fontSize: s(13),
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: s(16),
    paddingVertical: s(12),
  },
  disclaimer: {
    flexDirection: 'row',
    gap: s(8),
    padding: s(16),
    paddingTop: s(8),
  },
  disclaimerText: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
    lineHeight: s(18),
  },

  signOutBtn: {
    alignSelf: 'center',
    paddingVertical: s(12),
    paddingHorizontal: s(32),
    marginBottom: s(8),
  },
  signOutText: {
    fontFamily: Font.regular,
    fontSize: s(15),
    color: Colors.danger,
  },
  versionText: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textFaint,
    textAlign: 'center',
    paddingBottom: s(8),
  },
});
