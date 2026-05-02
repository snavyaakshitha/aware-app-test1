/**
 * ScanResultScreen — complete rebuild (light mode).
 *
 * Three-tab layout:
 *   Tab 1 "Our Take"    — verdict, personalised flags, Aware's editorial, additives, banned substances
 *   Tab 2 "Nutrition"   — Nutri-Score, NOVA, full per-100g table with "What This Means" column
 *   Tab 3 "Ingredients" — colour-coded chips (allergen / concern / ok), tappable for detail
 *
 * Analysis runs for ALL users (authenticated or not).
 * Unauthenticated users get additive + ban + allergen RPCs; personalisation (health conditions,
 * allergens from profile) is skipped — a soft sign-in promo is shown instead.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Image, Modal, TextInput,
  KeyboardAvoidingView, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { s } from '../../../shared/theme';
import { getProductById } from '../../../shared/mockData';
import { fetchProductByBarcode, fetchProductWithCategory } from '../../../shared/productCatalog';
import type { OffProductSnapshot, OffNutriments } from '../../../shared/openFoodFacts';
import { supabase, fetchUserPreferences, getCurrentUser } from '../../../shared/supabase';
import { loadAIResult, fetchCachedProduct } from '../../../shared/aiProduct';
import {
  fetchProductAnalysis, fetchAISummary, fetchSkinCareAnalysis,
  type ProductAnalysisResult, type SafetyAnalysis,
  type AdditiveAnalysis, type BannedSubstanceMatch,
} from '../../../shared/scoring';
import type { SkinCareAnalysisResult, ProductDetectionCategory, BannedIngredientMatch } from '../../../shared/types';
import SkinSafetyTab from './tabs/SkinSafetyTab';
import {
  fmtNum, inferNovaGroup, deriveOverallVerdict,
  buildNutrientRows, generateHeadline, generateAwareTake,
  generateVerdictSentence, inferProductSubCategory,
  buildNutrientRows, generateHeadline, generateAwareTake, getDecisionSummary,
  type OverallVerdict, type NutrientRow,
} from '../../../shared/awaretake';
import type { ScannerStackParamList, UserPreferences } from '../../../shared/types';
import type { OnboardingData } from '../../../shared/onboardingTypes';

type Props = NativeStackScreenProps<ScannerStackParamList, 'ScanResult'>;

// ─── Load state ───────────────────────────────────────────────────────────────

type AnalysisFailureReason = 'no_user' | 'unavailable' | null;

type LoadState =
  | { kind: 'loading'; message?: string }
  | { kind: 'error'; message: string }
  | { kind: 'mock'; product: NonNullable<ReturnType<typeof getProductById>> }
  | {
      kind: 'off';
      off: OffProductSnapshot;
      analysis: ProductAnalysisResult | null;
      analysisFailureReason: AnalysisFailureReason;
      aiSummary: string | null;
      prefs: Partial<UserPreferences> | null;
      obData: OnboardingData | null;
      userId: string | null;
      category: ProductDetectionCategory;
      skincareAnalysis: SkinCareAnalysisResult | null;
      lastScannedAt: string | null;
    };

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'take' | 'nutrition' | 'ingredients' | 'skin-safety';

// ─── URL safety helper ────────────────────────────────────────────────────────

function openSafeUrl(url: string | null | undefined): void {
  if (!url) return;
  if (!url.startsWith('https://') && !url.startsWith('http://')) return;
  Linking.openURL(url);
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<OverallVerdict, string> = {
  red: 'Avoid', yellow: 'Check below', green: 'Good choice',
};
const VERDICT_COLOR: Record<OverallVerdict, string> = {
  red: '#ff4d4d', yellow: '#ffb830', green: '#2ed573',
  avoid: '#DC2626', check: '#D97706', acceptable: '#16A34A', good: '#15803D',
};
const VERDICT_BG: Record<OverallVerdict, string> = {
  red: '#3d0a0a', yellow: '#2e2000', green: '#0a1f12',
  avoid: '#FEF2F2', check: '#FFFBEB', acceptable: '#F0FDF4', good: '#F0FDF4',
};
const VERDICT_BORDER: Record<OverallVerdict, string> = {
  red: '#6b1a1a', yellow: '#5a3d00', green: '#1a5c30',
  avoid: '#FECACA', check: '#FDE68A', acceptable: '#BBF7D0', good: '#BBF7D0',
};

// ─── Allergen keyword map ─────────────────────────────────────────────────────

const ALLERGEN_KW: Record<string, string[]> = {
  gluten:     ['wheat', 'barley', 'rye', 'gluten', 'spelt', 'semolina'],
  dairy:      ['milk', 'cream', 'butter', 'whey', 'casein', 'lactose', 'cheese', 'yogurt'],
  eggs:       ['egg', 'albumin', 'lysozyme'],
  peanuts:    ['peanut', 'groundnut', 'arachis'],
  tree_nuts:  ['hazelnut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio'],
  soy:        ['soy', 'soya', 'tofu', 'tempeh', 'edamame'],
  sesame:     ['sesame', 'tahini'],
  shellfish:  ['shrimp', 'prawn', 'crab', 'lobster'],
  fish:       ['fish', 'tuna', 'salmon', 'cod', 'anchovy', 'sardine'],
  sulfites:   ['sulphite', 'sulfite', 'sulphur dioxide'],
};

const CONCERN_KW = [
  'palm oil', 'high fructose', 'hfcs', 'glucose-fructose', 'partially hydrogenated',
  'aspartame', 'sucralose', 'saccharin', 'acesulfame', 'artificial flavour',
  'artificial flavor', 'artificial colour', 'artificial color', 'carrageenan',
  'maltodextrin', 'msg', 'monosodium glutamate', 'bha', 'bht', 'tbhq',
  'sodium nitrate', 'sodium nitrite', 'modified starch', 'polysorbate',
  'red 40', 'yellow 5', 'yellow 6', 'titanium dioxide', 'azodicarbonamide',
];

interface IngredientChip {
  name: string;
  flag: 'allergen' | 'concern' | 'ok';
  reason?: string;
}

function buildChips(text: string, userAllergens: string[]): IngredientChip[] {
  if (!text.trim()) return [];
  const parts: string[] = [];
  let cur = ''; let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if ((ch === ',' || ch === ';') && depth === 0) {
      if (cur.trim()) parts.push(cur.trim()); cur = ''; continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.map((raw) => {
    const name = raw.replace(/\s+/g, ' ').trim();
    const lower = name.toLowerCase();
    for (const a of userAllergens) {
      if ((ALLERGEN_KW[a] ?? []).some((kw) => lower.includes(kw)))
        return { name, flag: 'allergen' as const, reason: a.replace(/_/g, ' ') };
    }
    for (const kw of CONCERN_KW) {
      if (lower.includes(kw)) return { name, flag: 'concern' as const, reason: kw };
    }
    return { name, flag: 'ok' as const };
  });
}

function buildMergedAllergens(
  prefs: Partial<UserPreferences> | null,
  obData: OnboardingData | null,
): string[] {
  const base = (prefs?.allergens as string[] | undefined) ?? [];
  if (!obData?.foodAllergies?.length) return base;
  const names = obData.foodAllergies.map((a) => a.name.toLowerCase());
  const extras: string[] = [];
  if (names.some((n) => n.includes('milk') || n.includes('dairy')) && !base.includes('dairy')) extras.push('dairy');
  if (names.some((n) => n.includes('wheat') || n.includes('gluten')) && !base.includes('gluten')) extras.push('gluten');
  if (names.some((n) => n.includes('peanut')) && !base.includes('peanuts')) extras.push('peanuts');
  if (names.some((n) => n.includes('egg')) && !base.includes('eggs')) extras.push('eggs');
  if (names.some((n) => n.includes('soy')) && !base.includes('soy')) extras.push('soy');
  return [...base, ...extras];
}

// ─── Severity colour helpers ─────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  severe: '#DC2626', high: '#EA580C', medium: '#D97706', low: '#9CA3AF',
};
const SEV_BG: Record<string, string> = {
  severe: '#FFF5F5', high: '#FFF7ED', medium: '#FFFBEB', low: '#FAFAFA',
};
const SEV_CONTEXT: Record<string, string> = {
  severe: 'Strong evidence of harm. Avoiding is recommended regardless of quantity.',
  high: 'Significant concerns backed by multiple studies. Worth limiting in your regular diet.',
  medium: 'Evidence is emerging or mixed. Safe at typical doses for most people.',
  low: 'Low concern at typical dietary exposure. Listed for transparency.',
};

const ALERT_COLOR = { red: '#EF4444', amber: '#F59E0B', green: '#22C55E', none: '#AAAAAA' };
const ALERT_BG    = { red: '#FFF5F5', amber: '#FFFBEB', green: '#F0FFF4', none: 'transparent' };

// ─── NOVA / Nutri-Score data ─────────────────────────────────────────────────

const NOVA_DATA: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: 'NOVA 1', color: '#16A34A', desc: 'Unprocessed or minimally processed' },
  2: { label: 'NOVA 2', color: '#D97706', desc: 'Processed culinary ingredients' },
  3: { label: 'NOVA 3', color: '#EA580C', desc: 'Processed foods' },
  4: { label: 'NOVA 4', color: '#DC2626', desc: 'Ultra-processed foods' },
};
const NS_COLORS: Record<string, string> = {
  a: '#00843d', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63312',
};
const NS_DESCS: Record<string, string> = {
  a: 'Excellent nutritional quality', b: 'Good nutritional quality',
  c: 'Average nutritional quality',   d: 'Poor nutritional quality',
  e: 'Very poor nutritional quality',
};

const NOVA_EXPLAIN: Record<number, { title: string; desc: string; examples: string }> = {
  1: { title: 'Unprocessed or minimally processed', desc: 'Natural foods with no or minimal industrial processing.', examples: 'Fruits, vegetables, eggs, plain meat, milk, plain grains.' },
  2: { title: 'Processed culinary ingredients', desc: 'Substances extracted from Group 1 foods, used in home cooking.', examples: 'Oils, butter, sugar, salt, flour, honey.' },
  3: { title: 'Processed foods', desc: 'Products made by adding salt, sugar, or oil to Group 1 foods.', examples: 'Canned fish, cheese, cured meats, freshly baked bread.' },
  4: { title: 'Ultra-processed foods', desc: 'Industrial formulations with 5+ ingredients — many not found in a home kitchen. Associated with higher rates of obesity, diabetes, and cardiovascular disease.', examples: 'Soft drinks, chips, candy bars, instant noodles, packaged snacks.' },
};
const NS_EXPLAIN: Record<string, { desc: string; detail: string }> = {
  a: { desc: 'Excellent', detail: 'High in fibre, protein, fruits/veg. Very low in sugar, saturated fat, salt.' },
  b: { desc: 'Good', detail: 'Good balance of positive and negative nutrients.' },
  c: { desc: 'Average', detail: 'Moderate levels on both sides. Fine occasionally.' },
  d: { desc: 'Poor', detail: 'High in calories, saturated fat, sugar, or salt. Limit frequency.' },
  e: { desc: 'Very poor', detail: 'Very high in negatives with few positives. Occasional treat only.' },
};

// ─── GlobalBan jurisdiction grouping helper ───────────────────────────────────
// Groups ban rows by jurisdiction so the UI shows:
//   🇺🇸 Banned in US: Red 40, Yellow 5
//   🇪🇺 Banned in EU: Red 40, Yellow 5

interface JurisdictionBanGroup {
  jurisdiction: string;
  flag: string;
  ingredients: string[];
  reasons: string[];
  sourceUrls: string[];
}

function getJurisdictionFlag(code: string): string {
  const FLAGS: Record<string, string> = {
    US: '🇺🇸', EU: '🇪🇺', CA: '🇨🇦', GB: '🇬🇧', AU: '🇦🇺',
    DE: '🇩🇪', FR: '🇫🇷', JP: '🇯🇵', CN: '🇨🇳', BR: '🇧🇷',
    KR: '🇰🇷', IN: '🇮🇳', MX: '🇲🇽', CH: '🇨🇭', SE: '🇸🇪',
    NO: '🇳🇴', DK: '🇩🇰', IT: '🇮🇹', ES: '🇪🇸', NL: '🇳🇱',
    NZ: '🇳🇿', SG: '🇸🇬', ZA: '🇿🇦', TH: '🇹🇭', MY: '🇲🇾',
  };
  return FLAGS[code] ?? '🌐';
}

// US and EU-area jurisdictions listed first, then alphabetical
const JURISDICTION_ORDER: Record<string, number> = {
  US: 0, EU: 1, CA: 2, GB: 3, AU: 4, DE: 5, FR: 6,
};

function groupBansByJurisdiction(items: BannedIngredientMatch[]): JurisdictionBanGroup[] {
  const map = new Map<string, { ingredients: Set<string>; reasons: string[]; sourceUrls: string[] }>();
  for (const item of items) {
    if (!map.has(item.country_code)) {
      map.set(item.country_code, { ingredients: new Set(), reasons: [], sourceUrls: [] });
    }
    const entry = map.get(item.country_code)!;
    entry.ingredients.add(item.ingredient_name);
    if (item.reason && !entry.reasons.includes(item.reason)) entry.reasons.push(item.reason);
    if (item.regulation_link && !entry.sourceUrls.includes(item.regulation_link)) entry.sourceUrls.push(item.regulation_link);
  }
  return Array.from(map.entries())
    .map(([code, data]) => ({
      jurisdiction: code,
      flag: getJurisdictionFlag(code),
      ingredients: Array.from(data.ingredients),
      reasons: data.reasons,
      sourceUrls: data.sourceUrls,
    }))
    .sort((a, b) => {
      const pa = JURISDICTION_ORDER[a.jurisdiction] ?? 99;
      const pb = JURISDICTION_ORDER[b.jurisdiction] ?? 99;
      return pa !== pb ? pa - pb : a.jurisdiction.localeCompare(b.jurisdiction);
    });
}

// ─── Modals ───────────────────────────────────────────────────────────────────

interface AdditiveItem {
  ingredient: string;
  severity: string | null;
  reason: string | null;
  source_url?: string | null;
}

function AdditiveDetailModal({ item, onClose }: { item: AdditiveItem | null; onClose: () => void }) {
  if (!item) return null;
  const sev = item.severity ?? 'low';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[ms.badge, { backgroundColor: SEV_BG[sev], borderWidth: 1, borderColor: sev === 'severe' ? '#FECACA' : sev === 'high' ? '#FED7AA' : '#FDE68A' }]}>
                <View style={[ms.badgeDot, { backgroundColor: SEV_COLOR[sev] }]} />
                <Text style={[ms.badgeText, { color: SEV_COLOR[sev] }]}>{sev.toUpperCase()} CONCERN</Text>
              </View>
              <Text style={ms.title}>{item.ingredient}</Text>
              <View style={ms.divider} />
              <View style={ms.section}>
                <Text style={ms.sectionLabel}>WHAT IT IS</Text>
                <Text style={ms.body}>{item.reason ?? 'No additional information available.'}</Text>
              </View>
              <View style={ms.section}>
                <Text style={ms.sectionLabel}>SOURCE</Text>
                {item.source_url ? (
                  <Pressable style={ms.sourceRow} onPress={() => openSafeUrl(item.source_url)}>
                    <Text>🔗</Text>
                    <Text style={ms.sourceText} numberOfLines={1}>{item.source_url}</Text>
                    <Text style={{ color: '#AAAAAA' }}>›</Text>
                  </Pressable>
                ) : (
                  <Text style={[ms.body, { color: '#AAAAAA', fontStyle: 'italic' }]}>
                    Source pending — we're building our scientific evidence library.
                  </Text>
                )}
              </View>
              <View style={[ms.section, ms.contextBox]}>
                <Text style={ms.sectionLabel}>CONTEXT</Text>
                <Text style={[ms.body, { fontSize: s(12) }]}>{SEV_CONTEXT[sev]}</Text>
              </View>
              <View style={{ height: s(8) }} />
            </ScrollView>
            <Pressable style={ms.doneBtn} onPress={onClose}>
              <Text style={ms.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

interface BeneficialItem { ingredient: string; reason: string | null; }

function BeneficialDetailModal({ item, onClose }: { item: BeneficialItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[ms.badge, { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }]}>
                <Text style={[ms.badgeText, { color: '#15803D' }]}>✦ BENEFICIAL</Text>
              </View>
              <Text style={ms.title}>{item.ingredient}</Text>
              <View style={ms.divider} />
              <View style={ms.section}>
                <Text style={ms.sectionLabel}>WHY IT MATTERS</Text>
                <Text style={ms.body}>{item.reason ?? 'A beneficial component in this product.'}</Text>
              </View>
              <View style={{ height: s(8) }} />
            </ScrollView>
            <Pressable style={ms.doneBtn} onPress={onClose}>
              <Text style={ms.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function BannedSubstanceModal({ item, onClose }: { item: BannedSubstanceMatch | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[ms.badge, { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }]}>
                <View style={[ms.badgeDot, { backgroundColor: '#DC2626' }]} />
                <Text style={[ms.badgeText, { color: '#DC2626' }]}>
                  BANNED IN {item.jurisdictions.length} JURISDICTION{item.jurisdictions.length !== 1 ? 'S' : ''}
                </Text>
              </View>
              <Text style={ms.title}>{item.substanceName}</Text>
              <View style={ms.divider} />
              <View style={ms.section}>
                <Text style={ms.sectionLabel}>WHAT IT IS</Text>
                <Text style={ms.body}>{item.reason ?? 'No additional information.'}</Text>
              </View>
              <View style={ms.section}>
                <Text style={ms.sectionLabel}>BANNED IN</Text>
                <Text style={[ms.body, { color: '#DC2626', fontWeight: '600' }]}>
                  {item.jurisdictions.join(', ')}
                </Text>
              </View>
              {!!item.regulatoryBody && (
                <View style={ms.section}>
                  <Text style={ms.sectionLabel}>REGULATORY BODY</Text>
                  <Text style={ms.body}>{item.regulatoryBody}</Text>
                </View>
              )}
              <View style={[ms.section, ms.contextBox]}>
                <Text style={ms.sectionLabel}>NOTE</Text>
                <Text style={[ms.body, { fontSize: s(12) }]}>
                  Regulatory standards differ across jurisdictions. Always check local regulations.
                </Text>
              </View>
              {!!item.sourceUrl && (
                <View style={ms.section}>
                  <Text style={ms.sectionLabel}>SOURCE</Text>
                  <Pressable style={ms.sourceRow} onPress={() => openSafeUrl(item.sourceUrl)}>
                    <Text>🔗</Text>
                    <Text style={ms.sourceText} numberOfLines={1}>{item.sourceUrl}</Text>
                    <Text style={{ color: '#AAAAAA' }}>›</Text>
                  </Pressable>
                </View>
              )}
              <View style={{ height: s(8) }} />
            </ScrollView>
            <Pressable style={ms.doneBtn} onPress={onClose}>
              <Text style={ms.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function IngredientChipModal({
  chip, onClose,
}: { chip: IngredientChip | null; onClose: () => void }) {
  if (!chip) return null;
  const isAllergen = chip.flag === 'allergen';
  const isConcern = chip.flag === 'concern';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            <View style={[ms.badge, {
              backgroundColor: isAllergen ? '#FEF2F2' : isConcern ? '#FFF7ED' : '#F0FDF4',
              borderWidth: 1,
              borderColor: isAllergen ? '#FECACA' : isConcern ? '#FED7AA' : '#BBF7D0',
            }]}>
              <Text style={[ms.badgeText, {
                color: isAllergen ? '#DC2626' : isConcern ? '#EA580C' : '#16A34A',
              }]}>
                {isAllergen ? '⚠ ALLERGEN' : isConcern ? '⚠ CONCERN' : '✓ SAFE'}
              </Text>
            </View>
            <Text style={ms.title}>{chip.name}</Text>
            <View style={ms.divider} />
            {chip.reason && (
              <View style={ms.section}>
                <Text style={ms.sectionLabel}>{isAllergen ? 'ALLERGEN TYPE' : 'REASON FLAGGED'}</Text>
                <Text style={ms.body}>{chip.reason.charAt(0).toUpperCase() + chip.reason.slice(1)}</Text>
              </View>
            )}
            <Pressable style={ms.doneBtn} onPress={onClose}>
              <Text style={ms.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

type InfoModalType = 'nova' | 'nutriscore' | null;

function InfoModal({
  type, novaGroup, nutriscoreGrade, onClose,
}: { type: InfoModalType; novaGroup: number | null; nutriscoreGrade: string | null; onClose: () => void }) {
  const visible = type !== null;
  const renderNova = () => {
    if (!novaGroup) return null;
    const colors: Record<number, string> = { 1: '#16A34A', 2: '#D97706', 3: '#EA580C', 4: '#DC2626' };
    return (
      <>
        <Text style={ms.title}>NOVA Processing Groups</Text>
        <Text style={[ms.body, { color: '#888', marginBottom: s(16) }]}>
          Developed at the University of São Paulo. Classifies by industrial processing extent — not nutrient content.
        </Text>
        {([1, 2, 3, 4] as const).map((n) => (
          <View key={n} style={[ms.novaRow, n === novaGroup && { borderColor: '#D1D5DB', backgroundColor: '#F3F4F6' }]}>
            <View style={[ms.novaNum, { backgroundColor: colors[n] }]}>
              <Text style={ms.novaNumText}>{n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ms.body, { fontWeight: '700', color: '#1A1A1A', marginBottom: 2 }]}>{NOVA_EXPLAIN[n].title}</Text>
              <Text style={[ms.body, { fontSize: s(11) }]}>{NOVA_EXPLAIN[n].desc}</Text>
              {n === novaGroup && <Text style={[ms.body, { fontSize: s(11), color: '#AAAAAA', fontStyle: 'italic' }]}>e.g. {NOVA_EXPLAIN[n].examples}</Text>}
            </View>
          </View>
        ))}
        <Pressable style={ms.sourceRow} onPress={() => openSafeUrl('https://pubmed.ncbi.nlm.nih.gov/27296553/')}>
          <Feather name="external-link" size={12} color="#2563EB" />
          <Text style={ms.sourceText}>Monteiro et al. — NOVA classification (Public Health Nutrition)</Text>
        </Pressable>
      </>
    );
  };
  const renderNutriscore = () => {
    if (!nutriscoreGrade) return null;
    const grade = nutriscoreGrade.toLowerCase();
    const gradeColors: Record<string, string> = { a: '#00843D', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63312' };
    return (
      <>
        <Text style={ms.title}>Nutri-Score</Text>
        <Text style={[ms.body, { color: '#888', marginBottom: s(16) }]}>
          French public health label. Grades A–E based on positive (fibre, protein) vs negative (calories, sat-fat, sugar, salt) nutrients per 100g.
        </Text>
        <View style={{ flexDirection: 'row', gap: s(4), marginBottom: s(14) }}>
          {(['a', 'b', 'c', 'd', 'e'] as const).map((g) => (
            <View key={g} style={[{ flex: 1, borderRadius: s(8), padding: s(8), alignItems: 'center', borderWidth: 1.5, borderColor: g === grade ? gradeColors[g] : '#E8E8E8', backgroundColor: g === grade ? '#F9FAFB' : '#FAFAFA' }]}>
              <Text style={{ fontWeight: '800', fontSize: s(18), color: gradeColors[g] }}>{g.toUpperCase()}</Text>
              <Text style={{ fontSize: s(9), color: '#999', textAlign: 'center' }}>{NS_EXPLAIN[g]?.desc}</Text>
            </View>
          ))}
        </View>
        <View style={[ms.contextBox, ms.section]}>
          <Text style={ms.sectionLabel}>THIS PRODUCT — {grade.toUpperCase()}</Text>
          <Text style={ms.body}>{NS_EXPLAIN[grade]?.detail}</Text>
        </View>
        <Pressable style={ms.sourceRow} onPress={() => openSafeUrl('https://www.santepubliquefrance.fr/en/nutri-score')}>
          <Feather name="external-link" size={12} color="#2563EB" />
          <Text style={ms.sourceText}>Official Nutri-Score methodology — santepubliquefrance.fr</Text>
        </Pressable>
      </>
    );
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {type === 'nova' ? renderNova() : renderNutriscore()}
              <View style={{ height: 8 }} />
            </ScrollView>
            <Pressable style={ms.doneBtn} onPress={onClose}>
              <Text style={ms.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function FeedbackModal({
  visible, barcode, userId, onClose,
}: { visible: boolean; barcode: string; userId: string | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const MAX = 500;
  const canSubmit = text.trim().length > 0 && text.length <= MAX && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      if (supabase) {
        const { error } = await supabase.from('product_feedback').insert({
          user_id: userId ?? null, barcode,
          feedback_type: 'incorrect_score', comment: text.trim(),
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      setSubmittedAt(new Date());
      setDone(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setText(''); setDone(false); setSubmitError(false); setSubmittedAt(null); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={ms.overlay} onPress={handleClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            {done ? (
              <View style={{ alignItems: 'center', paddingVertical: s(24), gap: s(8) }}>
                <Text style={{ fontSize: 36 }}>✓</Text>
                <Text style={{ fontWeight: '700', fontSize: s(20), color: '#16A34A' }}>Thank you</Text>
                <Text style={{ fontSize: s(13), color: '#666', textAlign: 'center', lineHeight: s(20), paddingHorizontal: s(8) }}>
                  We received your report. We'll review it and update if needed.
                </Text>
                {submittedAt && (
                  <Text style={{ fontSize: s(11), color: '#AAAAAA', marginTop: s(4) }}>
                    Submitted {submittedAt.toLocaleTimeString()}
                  </Text>
                )}
              </View>
            ) : (
              <>
                <Text style={ms.title}>Something wrong?</Text>
                <Text style={[ms.body, { color: '#888', marginBottom: s(12) }]}>
                  Tell us what's incorrect — wrong verdict, missing ingredient, misidentified allergen.
                </Text>
                {submitError && (
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: s(8), padding: s(10), marginBottom: s(10) }}>
                    <Text style={{ color: '#DC2626', fontSize: s(13) }}>
                      Couldn't send your report. Check your connection and try again.
                    </Text>
                  </View>
                )}
                <TextInput
                  style={[styles.feedbackInput, text.length > MAX && { borderColor: '#EF4444' }]}
                  placeholder="Describe the issue... (max 500 characters)"
                  placeholderTextColor="#AAAAAA"
                  multiline numberOfLines={4}
                  value={text}
                  onChangeText={(t) => t.length <= MAX && setText(t)}
                  maxLength={MAX}
                  editable={!submitting}
                />
                <View style={{ alignItems: 'flex-end', marginBottom: s(8) }}>
                  <Text style={{ fontSize: s(11), color: text.length > MAX * 0.9 ? '#F59E0B' : '#AAAAAA' }}>
                    {text.length}/{MAX}
                  </Text>
                </View>
              </>
            )}
            <Pressable
              style={[ms.doneBtn, done && { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }, (!canSubmit && !done) && { opacity: 0.5 }]}
              onPress={done ? handleClose : submit}
              disabled={!canSubmit && !done}
            >
              <Text style={[ms.doneBtnText, done && { color: '#15803D' }]}>
                {done ? 'Close' : submitting ? 'Sending…' : submitError ? 'Try again' : text.trim().length === 0 ? 'Describe the issue' : 'Send report'}
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Tab content components ───────────────────────────────────────────────────

function OurTakeTab({
  off, analysis, analysisFailureReason, aiSummary, conditions, effectiveNova,
  userId,
  onAdditiveSelect, onBannedSelect, onBeneficialSelect,
  onFeedback,
}: {
  off: OffProductSnapshot;
  analysis: ProductAnalysisResult | null;
  analysisFailureReason: AnalysisFailureReason;
  aiSummary: string | null;
  conditions: string[];
  effectiveNova: number | null;
  userId: string | null;
  onAdditiveSelect: (item: AdditiveItem) => void;
  onBannedSelect: (item: BannedSubstanceMatch) => void;
  onBeneficialSelect: (item: BeneficialItem) => void;
  onFeedback: () => void;
}) {
  const safety = analysis?.safety;
  const additives = analysis?.additives;
  const banned = analysis?.bannedSubstances ?? [];
  // Deduplicate: remove any global-ban rows whose ingredient name is already
  // captured by the legacy bannedSubstances card — avoids showing BHA twice.
  const _legacyNames = useMemo(
    () => new Set(banned.map(b => b.substanceName.toLowerCase())),
    [banned],
  );
  const globalBanIngredients = useMemo(
    () => (analysis?.globalBans?.bannedIngredients ?? []).filter(
      b => !_legacyNames.has(b.ingredient_name.toLowerCase()),
    ),
    [analysis, _legacyNames],
  );
  const jurisdictionBanGroups = useMemo(() => groupBansByJurisdiction(globalBanIngredients), [globalBanIngredients]);
  // Unique ingredient count for the collapsed header
  const uniqueBannedIngredients = useMemo(
    () => [...new Set(globalBanIngredients.map(b => b.ingredient_name))],
    [globalBanIngredients],
  );

  // Global bans card: collapsed by default to avoid UI overwhelm
  const [globalBansExpanded, setGlobalBansExpanded] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>

      {/* NOVA 1 editorial card */}
      {analysis === null && effectiveNova === 1 && (
        <View style={[styles.card, styles.cardGreen]}>
          <Text style={[styles.cardLabel, { color: '#15803D' }]}>🌿 WHOLE FOOD</Text>
          <Text style={{ color: '#374151', fontSize: s(13), lineHeight: s(20) }}>
            This appears to be an unprocessed or minimally processed food (NOVA 1). No industrial
            additives, no ultra-processing — as close to nature as food gets.
          </Text>
        </View>
      )}

      {/* Service error — analysis failed */}
      {analysisFailureReason === 'unavailable' && (
        <View style={[styles.card, { borderColor: '#E8E8E8' }]}>
          <Text style={[styles.cardLabel, { color: '#AAAAAA' }]}>⚠ ANALYSIS UNAVAILABLE</Text>
          <Text style={{ color: '#AAAAAA', fontSize: s(13), lineHeight: s(20) }}>
            The ingredient safety check couldn't complete right now. Nutrition data and ingredient
            list are still available. Pull to refresh or re-scan to retry.
          </Text>
        </View>
      )}

      {/* Aware's Take */}
      {analysis && (
        <View style={styles.awareTakeCard}>
          <Text style={styles.awareTakeLabel}>💡 Aware's take</Text>
          <Text style={styles.awareTakeText}>
            {generateAwareTake(off, analysis, conditions, effectiveNova)}
          </Text>
        </View>
      )}

      {/* Global bans — grouped by jurisdiction, collapsed by default */}
      {jurisdictionBanGroups.length > 0 && (
        <View style={[styles.card, styles.cardRed]}>
          {/* Collapsed header row — always visible */}
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            onPress={() => setGlobalBansExpanded((v) => !v)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flex: 1 }}>
              <Text style={{ fontSize: s(16) }}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: '#DC2626' }]}>
                  {uniqueBannedIngredients.length} ingredient{uniqueBannedIngredients.length !== 1 ? 's' : ''} flagged in {jurisdictionBanGroups.length} jurisdiction{jurisdictionBanGroups.length !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.rowSub}>
                  {jurisdictionBanGroups.slice(0, 4).map(g => `${g.flag} ${g.jurisdiction}`).join('  ')}
                  {jurisdictionBanGroups.length > 4 ? ` +${jurisdictionBanGroups.length - 4} more` : ''}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: s(16), color: '#DC2626', marginLeft: s(4) }}>
              {globalBansExpanded ? '▲' : '▼'}
            </Text>
          </Pressable>

          {/* Expanded list — one row per jurisdiction */}
          {globalBansExpanded && jurisdictionBanGroups.map((group, i) => {
            const ingDisplay = group.ingredients.length <= 3
              ? group.ingredients.join(', ')
              : `${group.ingredients.slice(0, 2).join(', ')} +${group.ingredients.length - 2} more`;
            return (
              <View
                key={i}
                style={[styles.row, styles.rowBorder]}
              >
                <Text style={{ fontSize: s(18), flexShrink: 0, lineHeight: s(22), marginTop: s(2) }}>
                  {group.flag}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Banned in {group.jurisdiction}</Text>
                  <Text style={styles.rowSub} numberOfLines={2}>{ingDisplay}</Text>
                </View>
                {group.sourceUrls.length > 0 && (
                  <Pressable onPress={() => openSafeUrl(group.sourceUrls[0])} hitSlop={8}>
                    <Text style={{ fontSize: s(11), color: '#2563EB', flexShrink: 0 }}>Source ↗</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Legacy banned substances */}
      {banned.length > 0 && (
        <View style={[styles.card, styles.cardRed]}>
          <Text style={styles.cardLabel}>🚫 BANNED SUBSTANCES ({banned.length}) — TAP FOR DETAILS</Text>
          {banned.map((item, i) => (
            <Pressable
              key={i}
              style={[styles.row, i < banned.length - 1 && styles.rowBorder]}
              onPress={() => onBannedSelect(item)}
            >
              <View style={[styles.dot, { backgroundColor: '#DC2626' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.substanceName}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  Banned in: {item.jurisdictions.slice(0, 3).join(', ')}{item.jurisdictions.length > 3 ? ` +${item.jurisdictions.length - 3}` : ''}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[styles.badgeText, { color: '#DC2626' }]}>BANNED</Text>
              </View>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Safety verdict */}
      {safety && (
        <SafetySection safety={safety} />
      )}

      {/* Additives */}
      <AdditivesSection additives={additives ?? null} analysisRan={analysis !== null} onSelect={onAdditiveSelect} />

      {/* Beneficial ingredients */}
      {safety && safety.beneficialList.length > 0 && (
        <View style={[styles.card, styles.cardGreen]}>
          <Text style={styles.cardLabel}>✓ BENEFICIAL INGREDIENTS</Text>
          {safety.beneficialList.map((item, i) => (
            <Pressable
              key={i}
              style={[styles.row, i < safety.beneficialList.length - 1 && styles.rowBorder]}
              onPress={() => onBeneficialSelect(item)}
            >
              <Text style={{ fontSize: s(15), color: '#16A34A', flexShrink: 0 }}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: '#15803D' }]}>{item.ingredient}</Text>
                {!!item.reason && <Text style={styles.rowSub} numberOfLines={2}>{item.reason}</Text>}
              </View>
              <Text style={[styles.rowArrow, { color: '#16A34A' }]}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Soft sign-in promo for unauthenticated users */}
      {!userId && analysis !== null && (
        <View style={[styles.card, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.cardLabel, { color: '#2563EB' }]}>🔒 PERSONALIZE YOUR ANALYSIS</Text>
          <Text style={{ color: '#374151', fontSize: s(13), lineHeight: s(20) }}>
            Sign in to get allergen alerts and health condition flags tailored to your profile.
          </Text>
          <Text style={{ color: '#93C5FD', fontSize: s(11), marginTop: s(6) }}>
            Tap Profile → Sign in.
          </Text>
        </View>
      )}

      {/* AI quick insight (secondary) */}
      {!!aiSummary && (
        <View style={[styles.awareTakeCard, { opacity: 0.75, backgroundColor: '#F9FAFB', borderColor: '#E8EAED' }]}>
          <Text style={[styles.awareTakeLabel, { color: '#9CA3AF' }]}>🤖 AI quick insight</Text>
          <Text style={[styles.awareTakeText, { color: '#9CA3AF', fontSize: s(12) }]}>{aiSummary}</Text>
        </View>
      )}

      {/* Feedback */}
      <View style={{ alignItems: 'center', paddingVertical: s(16) }}>
        <Pressable style={styles.feedbackBtn} onPress={onFeedback}>
          <Text style={styles.feedbackBtnText}>Something wrong? Let us know →</Text>
        </Pressable>
      </View>

      <View style={{ height: s(32) }} />
    </ScrollView>
  );
}

function SafetySection({ safety }: { safety: SafetyAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const isGood = safety.allergenConflicts.length === 0 && safety.avoidList.length === 0 && safety.cautionList.length === 0;
  const isRed = safety.allergenConflicts.length > 0;

  if (isGood) {
    return (
      <View style={[styles.card, styles.cardGreen]}>
        <Text style={styles.cardLabel}>SAFETY VERDICT</Text>
        <View style={styles.safetyRow}>
          <Text style={{ fontSize: s(18), color: '#16A34A' }}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: '#15803D' }]}>No conflicts found</Text>
            <Text style={styles.rowSub}>No allergens or flagged ingredients detected.</Text>
          </View>
        </View>
      </View>
    );
  }

  const cautions = [...safety.avoidList, ...safety.cautionList];
  const visible = expanded ? cautions : cautions.slice(0, 2);

  return (
    <View style={[styles.card, isRed ? styles.cardRed : styles.cardYellow]}>
      <Text style={styles.cardLabel}>SAFETY VERDICT</Text>
      {safety.allergenConflicts.length > 0 && (
        <View style={[styles.safetyRow, { marginBottom: s(10) }]}>
          <Text style={{ fontSize: s(15) }}>🚨</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: '#DC2626' }]}>Allergen detected</Text>
            <Text style={styles.rowSub}>
              Contains:{' '}
              {safety.allergenConflicts.map((a, i) => (
                <Text key={i} style={{ color: '#DC2626', fontWeight: '600' }}>{a}</Text>
              ))}
            </Text>
          </View>
        </View>
      )}
      {visible.map((item, i) => (
        <View key={i} style={styles.safetyRow}>
          <Text style={{ fontSize: s(15) }}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item.ingredient}</Text>
            {!!item.reason && <Text style={styles.rowSub}>{item.reason}</Text>}
          </View>
        </View>
      ))}
      {cautions.length > 2 && (
        <Pressable onPress={() => setExpanded((v) => !v)} style={{ paddingTop: s(4) }}>
          <Text style={{ fontSize: s(11), color: '#AAAAAA' }}>
            {expanded ? '▲ Show less' : `▼ See ${cautions.length - 2} more`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function AdditivesSection({
  additives, analysisRan, onSelect,
}: { additives: AdditiveAnalysis | null; analysisRan: boolean; onSelect: (item: AdditiveItem) => void }) {
  if (!analysisRan) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>ADDITIVES</Text>
        <Text style={{ fontSize: s(13), color: '#AAAAAA', lineHeight: s(19) }}>
          Checking ingredients against our database…
        </Text>
      </View>
    );
  }
  if (!additives || additives.total === 0) {
    return (
      <View style={[styles.card, styles.cardGreen]}>
        <Text style={styles.cardLabel}>✓ ADDITIVES</Text>
        <Text style={{ fontSize: s(13), color: '#15803D' }}>No concerning additives detected.</Text>
      </View>
    );
  }
  const allItems: AdditiveItem[] = [
    ...additives.severe, ...additives.high, ...additives.medium, ...additives.low,
  ];
  const hasHighSev = additives.severe.length > 0 || additives.high.length > 0;
  return (
    <View style={[styles.card, hasHighSev ? styles.cardRed : styles.cardYellow]}>
      <Text style={styles.cardLabel}>⚠ ADDITIVES & INGREDIENTS ({allItems.length}) — TAP ANY TO LEARN MORE</Text>
      {allItems.map((item, i) => (
        <Pressable
          key={i}
          style={[styles.row, i < allItems.length - 1 && styles.rowBorder]}
          onPress={() => onSelect(item)}
        >
          <View style={[styles.dot, { backgroundColor: SEV_COLOR[item.severity ?? 'low'] }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item.ingredient}</Text>
            {!!item.reason && <Text style={styles.rowSub} numberOfLines={2}>{item.reason}</Text>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
            <View style={[styles.badge, { backgroundColor: SEV_BG[item.severity ?? 'low'], borderWidth: 1, borderColor: item.severity === 'severe' ? '#FECACA' : item.severity === 'high' ? '#FED7AA' : '#FDE68A' }]}>
              <Text style={[styles.badgeText, { color: SEV_COLOR[item.severity ?? 'low'] }]}>
                {(item.severity ?? 'low').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function NutritionTab({
  off, onInfoModal,
}: { off: OffProductSnapshot; onInfoModal: (t: 'nova' | 'nutriscore') => void }) {
  const nm = off.nutriments;
  const ns = off.nutriscoreGrade?.toLowerCase() ?? null;
  const nova = off.novaGroup;
  const effectiveNova = useMemo(() => inferNovaGroup(off), [off]);
  const subCat = useMemo(() => inferProductSubCategory(off, effectiveNova), [off, effectiveNova]);
  const nutrientRows = useMemo(
    () => nm ? buildNutrientRows(nm, effectiveNova, subCat) : [],
    [nm, effectiveNova, subCat],
  );

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>

      {/* Nutri-Score + NOVA row */}
      <View style={styles.metricsRow}>
        {/* Nutri-Score */}
        {(() => {
          const isZeroNutrient = nm !== null && nm !== undefined &&
            (nm.energy_kcal_100g === 0 || nm.energy_kcal_100g === null) &&
            (nm.proteins_100g === 0 || nm.proteins_100g === null) &&
            (nm.fat_100g === 0 || nm.fat_100g === null) &&
            (nm.sugars_100g === 0 || nm.sugars_100g === null);
          return (
            <Pressable
              style={styles.metricCard}
              onPress={() => ns && !isZeroNutrient && onInfoModal('nutriscore')}
              accessibilityRole="button"
              accessibilityLabel={ns ? `Nutri-Score ${ns.toUpperCase()}: ${NS_DESCS[ns]}. Tap to learn more.` : 'Nutri-Score not available'}
            >
              <Text style={styles.cardLabel}>NUTRI-SCORE</Text>
              {isZeroNutrient ? (
                <Text style={styles.metricMuted}>{'Not applicable\n(no nutrient content)'}</Text>
              ) : ns ? (
                <>
                  <View style={{ flexDirection: 'row', gap: s(3), marginBottom: s(6) }}>
                    {(['a', 'b', 'c', 'd', 'e'] as const).map((g) => (
                      <View key={g} style={[styles.nsBlock, { backgroundColor: NS_COLORS[g] }, g !== ns && { opacity: 0.2 }]}>
                        <Text style={[styles.nsBlockText, g === 'c' && { color: '#1A1A1A' }]}>{g.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.metricNote}>{NS_DESCS[ns]}</Text>
                  <Text style={styles.metricTapHint}>Tap to learn more ›</Text>
                </>
              ) : (
                <Text style={styles.metricMuted}>{'Not available\nfor this category'}</Text>
              )}
            </Pressable>
          );
        })()}

        {/* NOVA */}
        <Pressable
          style={styles.metricCard}
          onPress={() => effectiveNova && onInfoModal('nova')}
          accessibilityRole="button"
          accessibilityLabel={effectiveNova ? `NOVA ${effectiveNova}: ${NOVA_DATA[effectiveNova]?.desc}. Tap to learn more.` : 'NOVA processing level not available'}
        >
          <Text style={styles.cardLabel}>PROCESSING (NOVA)</Text>
          {effectiveNova ? (
            <>
              <View style={{ flexDirection: 'row', gap: s(3), marginBottom: s(6) }}>
                {([1, 2, 3, 4] as const).map((n) => (
                  <View key={n} style={[styles.novaBlock, { backgroundColor: NOVA_DATA[n].color }, n !== effectiveNova && { opacity: 0.2 }]}>
                    <Text style={styles.novaBlockText}>{n}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.metricNote} numberOfLines={2}>{NOVA_DATA[effectiveNova]?.desc}</Text>
              {nova === null && <Text style={[styles.metricTapHint, { fontStyle: 'italic' }]}>Inferred from product structure</Text>}
              {nova !== null && <Text style={styles.metricTapHint}>Tap to learn more ›</Text>}
            </>
          ) : (
            <Text style={styles.metricMuted}>{'Not\navailable'}</Text>
          )}
        </Pressable>
      </View>

      {/* Nutrition table */}
      {nm ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PER 100g — WHAT THIS MEANS</Text>
          {nutrientRows.map((row, i, arr) => (
            <View key={row.label} style={[
              styles.nutriRow,
              i < arr.length - 1 && styles.rowBorder,
              row.alert !== 'none' && { backgroundColor: ALERT_BG[row.alert] },
            ]}>
              <View style={{ width: s(90) }}>
                <Text style={styles.nutriLabel}>{row.label}</Text>
                <Text style={[styles.nutriValue, { color: row.alert !== 'none' ? ALERT_COLOR[row.alert] : '#1A1A1A' }]}>
                  {row.value !== null ? `${fmtNum(row.value)}${row.unit}` : '—'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nutriWhat, { color: row.alert !== 'none' ? ALERT_COLOR[row.alert] : '#888' }]}>
                  {row.what}
                </Text>
              </View>
              {row.alert !== 'none' && (
                <View style={[styles.alertDot, { backgroundColor: ALERT_COLOR[row.alert] }]} />
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>NUTRITION DATA</Text>
          <Text style={{ fontSize: s(13), color: '#AAAAAA', lineHeight: s(20) }}>
            Detailed nutrition data is not available for this product.
          </Text>
        </View>
      )}

      <View style={{ height: s(32) }} />
    </ScrollView>
  );
}

function IngredientsTab({
  off, userAllergens,
}: { off: OffProductSnapshot; userAllergens: string[] }) {
  const [selected, setSelected] = useState<IngredientChip | null>(null);
  const effectiveNova = useMemo(() => inferNovaGroup(off), [off]);
  const chips = useMemo(
    () => buildChips(off.ingredientsText, userAllergens),
    [off.ingredientsText, userAllergens],
  );

  const allergenCount = chips.filter((c) => c.flag === 'allergen').length;
  const concernCount = chips.filter((c) => c.flag === 'concern').length;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>

      {/* Legend */}
      <View style={styles.chipLegend}>
        {allergenCount > 0 && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} /><Text style={styles.legendText}>{allergenCount} allergen{allergenCount !== 1 ? 's' : ''}</Text></View>}
        {concernCount > 0 && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} /><Text style={styles.legendText}>{concernCount} concern{concernCount !== 1 ? 's' : ''}</Text></View>}
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} /><Text style={styles.legendText}>ok</Text></View>
      </View>

      {/* Chip grid */}
      {chips.length > 0 ? (
        <View style={styles.chipGrid}>
          {chips.map((chip, i) => (
            <Pressable
              key={i}
              style={[
                styles.chip,
                chip.flag === 'allergen' && styles.chipAllergen,
                chip.flag === 'concern' && styles.chipConcern,
              ]}
              onPress={() => setSelected(chip)}
            >
              <Text style={[
                styles.chipText,
                chip.flag === 'allergen' && { color: '#DC2626' },
                chip.flag === 'concern' && { color: '#EA580C' },
              ]} numberOfLines={2}>{chip.name}</Text>
              {chip.flag !== 'ok' && <Text style={styles.chipArrow}>›</Text>}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={{ fontSize: s(13), color: effectiveNova === 1 ? '#374151' : '#AAAAAA', lineHeight: s(20) }}>
            {effectiveNova === 1
              ? `This is a whole, unprocessed food. Its only "ingredient" is itself — no additives, no processing.`
              : 'No ingredient text available for this product in the database.'}
          </Text>
        </View>
      )}

      <View style={{ height: s(32) }} />

      <IngredientChipModal chip={selected} onClose={() => setSelected(null)} />
    </ScrollView>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScanResultScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { productId, barcode, category: routeCategory } = route.params ?? {};
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>(routeCategory === 'skincare' ? 'skin-safety' : 'take');
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [additiveModal, setAdditiveModal] = useState<AdditiveItem | null>(null);
  const [beneficialModal, setBeneficialModal] = useState<BeneficialItem | null>(null);
  const [bannedModal, setBannedModal] = useState<BannedSubstanceMatch | null>(null);

  const load = useCallback(async () => {
    if (barcode) {
      setState({ kind: 'loading' });
      const [userResult, obRaw] = await Promise.all([
        getCurrentUser().catch(() => null),
        AsyncStorage.getItem('@aware_onboarding_data').catch(() => null),
      ]);
      const userId = userResult?.id ?? null;
      let prefs: Partial<UserPreferences> | null = null;
      if (userId) prefs = await fetchUserPreferences(userId).catch(() => null);
      const obData: OnboardingData | null = obRaw ? JSON.parse(obRaw) as OnboardingData : null;

      let detectedCategory: ProductDetectionCategory = routeCategory ?? 'food';

      let snapshot: OffProductSnapshot | null = null;
      const cached = await fetchCachedProduct(barcode);
      if (cached?.ok) {
        snapshot = cached.product;
        if (!routeCategory && snapshot.detectedCategory && snapshot.detectedCategory !== 'unknown') {
          detectedCategory = snapshot.detectedCategory;
        }
      }
      if (!snapshot) {
        const isSkincare = detectedCategory === 'skincare';
        const res = isSkincare
          ? await fetchProductWithCategory(barcode)
          : await fetchProductByBarcode(barcode);
        if (res.ok) snapshot = res.product;
      }
      if (!snapshot) {
        const ai = await loadAIResult(barcode);
        if (ai) {
          snapshot = ai;
          if (!routeCategory && snapshot.detectedCategory && snapshot.detectedCategory !== 'unknown') {
            detectedCategory = snapshot.detectedCategory;
          }
        }
      }
      const isSkincare = detectedCategory === 'skincare';

      // ── Auto AI fallback — no dead-end error screen ───────────────────────
      if (!snapshot) {
        // Show a "Searching AI…" message briefly so the user knows what's happening
        setState({ kind: 'loading', message: 'Searching AI database…' });
        await new Promise(r => setTimeout(r, 120));
        navigation.replace('AIFallback', { barcode, category: routeCategory ?? 'food' });
        return;
      }

      const conditions = ((prefs?.healthConditions as string[] | undefined) ?? []);

      let analysis: ProductAnalysisResult | null = null;
      let analysisFailureReason: AnalysisFailureReason = null;
      let skincareAnalysis: SkinCareAnalysisResult | null = null;

      if (isSkincare) {
        skincareAnalysis = await fetchSkinCareAnalysis(snapshot.ingredientsText, userId).catch(() => null);
      } else {
        // Run analysis for ALL users — unauthenticated users get ban/additive/allergen RPCs,
        // personalization (health conditions, user allergens) is skipped when userId is null.
        try {
          analysis = await fetchProductAnalysis(barcode, userId, snapshot.ingredientsText);
          if (analysis === null) analysisFailureReason = 'unavailable';
        } catch {
          analysisFailureReason = 'unavailable';
        }
      }

      const aiSummary = isSkincare ? null : await fetchAISummary(
        barcode, userId, snapshot.productName, snapshot.ingredientsText, conditions,
      ).catch(() => null);

      // ── Last scanned timestamp (non-blocking, authenticated only) ─────────
      let lastScannedAt: string | null = null;
      if (supabase && userId) {
        try {
          const { data: scanRow } = await supabase
            .from('scanned_history')
            .select('scanned_at')
            .eq('user_id', userId)
            .eq('barcode', barcode)
            .order('scanned_at', { ascending: false })
            .limit(2); // limit 2 so we can find the *previous* scan (current one not yet inserted)
          // Use the second entry if present (the last historical scan before this one)
          const previousScan = scanRow && scanRow.length > 1 ? scanRow[1] : (scanRow?.[0] ?? null);
          lastScannedAt = previousScan?.scanned_at ?? null;
        } catch {
          // Non-critical — silently ignore
        }
      }

      setState({
        kind: 'off',
        off: snapshot,
        analysis,
        analysisFailureReason,
        aiSummary: aiSummary ?? null,
        prefs,
        obData,
        userId,
        category: detectedCategory,
        skincareAnalysis,
        lastScannedAt,
      });

      // Analytics (non-blocking)
      if (supabase) {
        const globalBanCount = analysis?.globalBans?.bannedIngredients.length ?? 0;
        const scanVerdict = analysis
          ? (analysis.safety.allergenConflicts.length > 0 || analysis.bannedSubstances.length > 0 ? 'red'
            : analysis.safety.avoidList.length > 0 || analysis.additives.severe.length > 0 ? 'red'
            : analysis.safety.cautionList.length > 0 || analysis.additives.high.length > 0 ? 'yellow'
            : 'green')
          ? (analysis.safety.allergenConflicts.length > 0 || analysis.bannedSubstances.length > 0 || globalBanCount > 0 ? 'avoid'
            : analysis.safety.avoidList.length > 0 || analysis.additives.severe.length > 0 ? 'avoid'
            : analysis.safety.cautionList.length > 0 || analysis.additives.high.length > 0 ? 'check'
            : 'good')
          : null;
        void supabase.from('scan_events').insert({
          user_id: userId ?? null,
          barcode,
          event_type: 'scan',
          verdict: scanVerdict,
          analysis_ran: analysis !== null,
          source: snapshot.catalogSource ?? null,
          created_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.warn('[analytics] scan_events insert failed:', error.message);
        });
      }

      return;
    }
    if (productId) {
      const product = getProductById(productId);
      if (!product) { setState({ kind: 'error', message: 'Product not found' }); return; }
      setState({ kind: 'mock', product }); return;
    }
    setState({ kind: 'error', message: 'Missing scan data' });
  }, [barcode, productId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!routeCategory && state.kind === 'off' && state.category === 'skincare') {
      setTab('skin-safety');
    }
  }, [routeCategory, state]);

  const effectiveNova = useMemo(
    () => state.kind === 'off' ? inferNovaGroup(state.off) : null,
    [state],
  );
  const headline = useMemo(
    () => state.kind === 'off' ? generateHeadline(state.off, state.analysis, effectiveNova) : '',
    [state, effectiveNova],
  );
  const userAllergens = useMemo(
    () => state.kind === 'off' ? buildMergedAllergens(state.prefs, state.obData) : [],
    [state],
  );
  const conditions = useMemo(
    () => state.kind === 'off' ? (state.prefs?.healthConditions as string[] | undefined) ?? [] : [],
    [state],
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={s(24)} color="#1A1A1A" />
      </Pressable>
      <Text style={styles.headerTitle}>Scan result</Text>
      <View style={{ width: s(40) }} />
    </View>
  );

  if (state.kind === 'loading') {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5B9700" />
          <Text style={{ fontSize: s(15), color: '#888', marginTop: s(12) }}>
            {state.message ?? 'Analysing product…'}
          </Text>
        </View>
      </View>
    );
  }

  if (state.kind === 'error') {
    const isNotFound = state.message.toLowerCase().includes('not found');
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <Text style={{ fontSize: s(48) }}>{isNotFound ? '📦' : '🔍'}</Text>
          <Text style={{ fontSize: s(18), fontWeight: '700', color: '#1A1A1A', textAlign: 'center', marginTop: s(12) }}>{state.message}</Text>
          {isNotFound && barcode && (
            <Pressable
              onPress={() => navigation.replace('AIFallback', { barcode })}
              style={[styles.retryBtn, { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }]}
            >
              <Text style={{ fontSize: s(15), color: '#15803D', fontWeight: '600' }}>Try AI analysis →</Text>
            </Pressable>
          )}
          <Pressable onPress={() => navigation.goBack()} style={[styles.retryBtn, { marginTop: s(8) }]}>
            <Text style={{ fontSize: s(15), color: '#888' }}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (state.kind === 'mock') {
    const { product } = state;
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <Text style={{ fontSize: s(64) }}>{product.emoji}</Text>
          <Text style={{ fontSize: s(18), fontWeight: '700', color: '#1A1A1A' }}>{product.name}</Text>
          <Text style={{ color: '#888' }}>{product.brand}</Text>
          <Text style={{ color: '#AAAAAA', fontSize: s(11), marginTop: s(12) }}>This is demo/catalog data.</Text>
        </View>
      </View>
    );
  }

  // ── Main OFF product view ────────────────────────────────────────────────────
  const { off, analysis, analysisFailureReason, aiSummary, category: detectedCategory, skincareAnalysis } = state;
  const isAI = off.catalogSource === 'ai_gemini' || off.catalogSource === 'ai_gpt';

  const banned = analysis?.bannedSubstances ?? [];
  const globalBanIngredients = analysis?.globalBans?.bannedIngredients ?? [];

  // Derive verdict — incorporate both legacy bans and global bans (1,100-row table)
  const baseVerdict = analysis
    ? deriveOverallVerdict(analysis.safety, analysis.additives, banned, effectiveNova, off.nutriscoreGrade)
    : (() => {
        if (effectiveNova === 1) return 'green' as const;
        const ns = off.nutriscoreGrade?.toLowerCase();
        if (ns === 'e' || ns === 'd') return 'yellow' as const;
        return 'green' as const;
      })();
  const verdictSentence = generateVerdictSentence(verdict, off, analysis, effectiveNova);
  const dataMismatch = off.dataConfidence === 'low';
  const hallucinationDetected = analysis?._hallucinationDetected === true;
  const verdict: OverallVerdict = (baseVerdict !== 'avoid' && globalBanIngredients.length > 0)
    ? 'avoid'
    : baseVerdict;

  return (
    <View style={styles.root}>
      {header}

      {/* Product hero */}
      <View style={styles.hero}>
        {off.imageUrl ? (
          <Image source={{ uri: off.imageUrl }} style={styles.heroThumb} resizeMode="contain" />
        ) : (
          <View style={[styles.heroThumb, styles.heroThumbPlaceholder]}>
            <Text style={{ fontSize: s(24) }}>📦</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          {!!off.brand && <Text style={styles.heroBrand}>{off.brand.toUpperCase()}</Text>}
          <Text style={styles.heroName} numberOfLines={2}>{off.productName}</Text>
          <Text style={styles.heroBarcode}>{off.code}</Text>
        </View>
      </View>

      {/* Data mismatch warning — shown when barcode data quality is 'low' */}
      {dataMismatch && (
        <View style={{ marginHorizontal: s(16), marginBottom: s(8), backgroundColor: '#2e1500', borderRadius: s(10), borderWidth: 1, borderColor: '#5a3d00', padding: s(10) }}>
          <Text style={{ color: '#ffb830', fontSize: s(12), fontWeight: '700', marginBottom: s(2) }}>⚠ Data quality warning</Text>
          <Text style={{ color: '#aaa', fontSize: s(11), lineHeight: s(17) }}>
            {(off.dataWarnings ?? []).join(' ')} Verify ingredients on the physical package before relying on this analysis.
          </Text>
        </View>
      )}

      {/* Hallucination warning — shown when AI ingredient extraction signals are suspicious */}
      {hallucinationDetected && (
        <View style={{ marginHorizontal: s(16), marginBottom: s(8), backgroundColor: '#2e2000', borderRadius: s(10), borderWidth: 1, borderColor: '#5a3d00', padding: s(10) }}>
          <Text style={{ color: '#ffb830', fontSize: s(12), fontWeight: '700', marginBottom: s(2) }}>⚠ Unusual ingredient data</Text>
          <Text style={{ color: '#aaa', fontSize: s(11), lineHeight: s(17) }}>
            The ingredient data for this product looks unusual. Analysis has been suppressed for safety — please verify the ingredients on the physical package.
          </Text>
        </View>
      )}

      {/* Verdict + mini scores + headline — food only */}
      {detectedCategory !== 'skincare' && (
        <View style={styles.verdictBlock}>
          <View
            style={[styles.pill, { backgroundColor: VERDICT_BG[verdict], borderColor: VERDICT_BORDER[verdict] }]}
            accessibilityLabel={`Overall verdict: ${VERDICT_LABEL[verdict]}`}
            accessibilityRole="text"
          >
            <View style={[styles.pillDot, { backgroundColor: VERDICT_COLOR[verdict] }]} />
            <Text style={[styles.pillText, { color: VERDICT_COLOR[verdict] }]}>{VERDICT_LABEL[verdict]}</Text>
          </View>
          <Text style={styles.verdictSentence}>{verdictSentence}</Text>
          <Text style={styles.verdictHeadline}>{headline}</Text>
          {/* Row 1: verdict pill + NS badge + NOVA badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(8), flexWrap: 'wrap' }}>
            <View
              style={[styles.pill, { backgroundColor: VERDICT_BG[verdict], borderColor: VERDICT_BORDER[verdict], marginBottom: 0 }]}
              accessibilityLabel={`Overall verdict: ${VERDICT_LABEL[verdict]}`}
              accessibilityRole="text"
            >
              <View style={[styles.pillDot, { backgroundColor: VERDICT_COLOR[verdict] }]} />
              <Text style={[styles.pillText, { color: VERDICT_COLOR[verdict] }]}>{VERDICT_LABEL[verdict]}</Text>
            </View>

            {/* Nutri-Score mini badge */}
            {off.nutriscoreGrade && (() => {
              const ns = off.nutriscoreGrade.toLowerCase();
              const nsBg: Record<string, string> = { a: '#00843d', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63312' };
              return (
                <Pressable
                  onPress={() => setInfoModal('nutriscore')}
                  style={{ backgroundColor: nsBg[ns] ?? '#999', borderRadius: s(6), paddingHorizontal: s(8), paddingVertical: s(4) }}
                >
                  <Text style={{ fontSize: s(11), fontWeight: '800', color: ns === 'c' ? '#1A1A1A' : '#fff' }}>
                    NS {ns.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })()}

            {/* NOVA mini badge */}
            {effectiveNova && (() => {
              const novaColors: Record<number, string> = { 1: '#16A34A', 2: '#D97706', 3: '#EA580C', 4: '#DC2626' };
              return (
                <Pressable
                  onPress={() => setInfoModal('nova')}
                  style={{ backgroundColor: novaColors[effectiveNova] ?? '#999', borderRadius: s(6), paddingHorizontal: s(8), paddingVertical: s(4) }}
                >
                  <Text style={{ fontSize: s(11), fontWeight: '800', color: '#fff' }}>
                    NOVA {effectiveNova}
                  </Text>
                </Pressable>
              );
            })()}

            {verdict === 'check' && analysis && (
              <Text style={{ fontSize: s(11), color: '#D97706', flexShrink: 1 }}>
                {(analysis.additives.high.length + analysis.additives.severe.length) > 0
                  ? `${analysis.additives.high.length + analysis.additives.severe.length} ingredient${analysis.additives.high.length + analysis.additives.severe.length !== 1 ? 's' : ''} flagged ↓`
                  : analysis.safety.cautionList.length > 0
                  ? `${analysis.safety.cautionList.length} caution${analysis.safety.cautionList.length !== 1 ? 's' : ''} ↓`
                  : 'See details ↓'}
              </Text>
            )}
          </View>

          {/* Decision summary — single bold line explaining the verdict */}
          <Text style={styles.decisionSummary}>
            {getDecisionSummary(analysis, effectiveNova, off.nutriscoreGrade)}
          </Text>

          {isAI && (
            <Text style={styles.aiDisclaimer}>🤖 AI-extracted — verify allergens on the physical package.</Text>
          )}
        </View>
      )}
      {detectedCategory === 'skincare' && isAI && (
        <View style={{ paddingHorizontal: s(16), paddingBottom: s(8) }}>
          <Text style={styles.aiDisclaimer}>🤖 AI-extracted — verify ingredients on the physical package.</Text>
        </View>
      )}

      {/* Divider between verdict block and tab bar */}
      <View style={styles.verdictDivider} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(detectedCategory === 'skincare'
          ? (['skin-safety', 'ingredients'] as Tab[])
          : (['take', 'nutrition', 'ingredients'] as Tab[])
        ).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'take' ? 'Our Take'
                : t === 'nutrition' ? 'Nutrition'
                : t === 'skin-safety' ? 'Skin Safety'
                : 'Ingredients'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'skin-safety' && skincareAnalysis && (
          <SkinSafetyTab
            analysis={skincareAnalysis}
            skinType={state.prefs?.skin_type}
            skinConcerns={state.prefs?.skin_concerns}
            productName={off.productName}
          />
        )}
        {tab === 'skin-safety' && !skincareAnalysis && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(24), gap: s(12) }}>
            <Text style={{ fontSize: s(32) }}>🧴</Text>
            <Text style={{ color: '#1A1A1A', fontSize: s(16), fontWeight: '700', textAlign: 'center' }}>
              No ingredient data found
            </Text>
            <Text style={{ color: '#888', fontSize: s(13), textAlign: 'center', lineHeight: s(20) }}>
              {off.ingredientsText?.trim()
                ? 'Our ingredient database couldn\'t analyse this product. Try again later.'
                : 'The product database doesn\'t have ingredient data for this barcode yet.'}
            </Text>
            {barcode && (
              <Pressable
                onPress={() => navigation.replace('AIFallback', { barcode, category: 'skincare' })}
                style={{ marginTop: s(8), backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: s(10), paddingHorizontal: s(20), paddingVertical: s(12) }}
              >
                <Text style={{ color: '#15803D', fontSize: s(14), fontWeight: '600' }}>
                  Try AI analysis →
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {tab === 'take' && (
          <OurTakeTab
            off={off} analysis={analysis} analysisFailureReason={analysisFailureReason}
            aiSummary={aiSummary} conditions={conditions}
            effectiveNova={effectiveNova}
            userId={state.userId}
            onAdditiveSelect={setAdditiveModal}
            onBannedSelect={setBannedModal}
            onBeneficialSelect={setBeneficialModal}
            onFeedback={() => setFeedbackOpen(true)}
          />
        )}
        {tab === 'nutrition' && (
          <NutritionTab off={off} onInfoModal={setInfoModal} />
        )}
        {tab === 'ingredients' && (
          <IngredientsTab off={off} userAllergens={userAllergens} />
        )}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + s(4) }]}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingVertical: s(10) }}>
          <Ionicons name="scan-outline" size={s(16)} color="#AAAAAA" />
          <Text style={styles.footerText}>Scan another product</Text>
        </Pressable>
        {state.lastScannedAt && (
          <Text style={styles.lastScannedText}>
            Last scanned {new Date(state.lastScannedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        )}
      </View>

      {/* All modals */}
      <InfoModal type={infoModal} novaGroup={effectiveNova} nutriscoreGrade={off.nutriscoreGrade} onClose={() => setInfoModal(null)} />
      <AdditiveDetailModal item={additiveModal} onClose={() => setAdditiveModal(null)} />
      <BeneficialDetailModal item={beneficialModal} onClose={() => setBeneficialModal(null)} />
      <BannedSubstanceModal item={bannedModal} onClose={() => setBannedModal(null)} />
      <FeedbackModal visible={feedbackOpen} barcode={off.code} userId={state.userId} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}

// ─── Modal styles ─────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#FFFFFF', borderRadius: s(24), borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1, borderColor: '#E8E8E8', padding: s(20), paddingBottom: s(8), maxHeight: '82%' },
  handle:     { width: s(36), height: s(4), backgroundColor: '#E0E0E0', borderRadius: s(2), alignSelf: 'center', marginBottom: s(18) },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: s(6), alignSelf: 'flex-start', paddingHorizontal: s(12), paddingVertical: s(5), borderRadius: s(8), marginBottom: s(14) },
  badgeDot:   { width: s(8), height: s(8), borderRadius: s(4) },
  badgeText:  { fontSize: s(12), fontWeight: '700' },
  title:      { fontSize: s(18), fontWeight: '800', color: '#1A1A1A', marginBottom: s(4) },
  divider:    { height: 1, backgroundColor: '#F0F0F0', marginBottom: s(14) },
  section:    { marginBottom: s(16) },
  sectionLabel: { fontSize: s(10), fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#AAAAAA', marginBottom: s(8) },
  body:       { fontSize: s(13), color: '#555', lineHeight: s(21) },
  contextBox: { backgroundColor: '#F9FAFB', borderRadius: s(12), padding: s(12), borderWidth: 1, borderColor: '#E8EAED' },
  sourceRow:  { flexDirection: 'row', alignItems: 'center', gap: s(6), padding: s(10), backgroundColor: '#F9FAFB', borderRadius: s(10), marginVertical: s(8), borderWidth: 1, borderColor: '#E8E8E8' },
  sourceText: { fontSize: s(12), color: '#2563EB', flex: 1 },
  doneBtn:    { backgroundColor: '#F5F5F5', borderRadius: s(12), padding: s(13), alignItems: 'center', marginTop: s(8), marginBottom: s(4) },
  doneBtnText: { fontSize: s(14), fontWeight: '600', color: '#1A1A1A' },
  novaRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: s(10), padding: s(10), borderRadius: s(10), borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#FAFAFA', marginBottom: s(6) },
  novaNum:    { width: s(28), height: s(28), borderRadius: s(6), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  novaNumText: { fontWeight: '800', fontSize: s(13), color: '#fff' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#FFFFFF' },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(12), padding: s(24) },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(20), paddingBottom: s(12), zIndex: 10, backgroundColor: '#FFFFFF' },
  backBtn:    { width: s(32), height: s(32), borderRadius: s(16), backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: s(13), color: '#999' },

  hero:       { flexDirection: 'row', gap: s(14), paddingHorizontal: s(16), paddingBottom: s(14), alignItems: 'flex-start' },
  heroThumb:  { width: s(60), height: s(60), borderRadius: s(12), backgroundColor: '#F5F5F5', flexShrink: 0, overflow: 'hidden' },
  heroThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroBrand:  { fontSize: s(10), color: '#AAAAAA', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: s(2) },
  heroName:   { fontSize: s(17), fontWeight: '700', color: '#1A1A1A', lineHeight: s(22), marginBottom: s(3) },
  heroBarcode: { fontSize: s(10), color: '#CCCCCC' },

  verdictBlock: { paddingHorizontal: s(16), paddingBottom: s(12) },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: s(8), alignSelf: 'flex-start', paddingHorizontal: s(16), paddingVertical: s(10), borderRadius: s(100), borderWidth: 1.5, marginBottom: s(10), minHeight: s(44) },
  pillDot:    { width: s(10), height: s(10), borderRadius: s(5) },
  pillText:   { fontSize: s(18), fontWeight: '800', letterSpacing: 0.3 },
  verdictSentence: { fontSize: s(14), color: '#ccc', lineHeight: s(21), marginBottom: s(6) },
  verdictHeadline: { fontSize: s(17), fontWeight: '700', color: '#fff', lineHeight: s(24) },
  aiDisclaimer: { fontSize: s(11), color: '#666', marginTop: s(6) },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: s(6), alignSelf: 'flex-start', paddingHorizontal: s(12), paddingVertical: s(5), borderRadius: s(100), borderWidth: 1.5, marginBottom: s(8) },
  pillDot:    { width: s(7), height: s(7), borderRadius: s(4) },
  pillText:   { fontSize: s(13), fontWeight: '700' },
  verdictHeadline: { fontSize: s(19), fontWeight: '800', color: '#1A1A1A', lineHeight: s(26) },
  decisionSummary: { fontSize: s(17), fontWeight: '700', color: '#1A1A1A', lineHeight: s(24), marginTop: s(6) },
  verdictDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: s(16), marginTop: s(4) },
  aiDisclaimer: { fontSize: s(11), color: '#AAAAAA', marginTop: s(6) },

  tabBar:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEEEEE', backgroundColor: '#FFFFFF' },
  tabItem:    { flex: 1, paddingVertical: s(12), alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#5B9700' },
  tabLabel:   { fontSize: s(13), color: '#AAAAAA', fontWeight: '500' },
  tabLabelActive: { color: '#5B9700', fontWeight: '700' },

  tabContent: { paddingHorizontal: s(16), paddingTop: s(14) },

  card:       { backgroundColor: '#F9FAFB', borderRadius: s(16), borderWidth: 1, borderColor: '#E8EAED', padding: s(14), marginBottom: s(10) },
  cardRed:    { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  cardYellow: { borderColor: '#FDE68A', backgroundColor: '#FFFBF0' },
  cardGreen:  { borderColor: '#BBF7D0', backgroundColor: '#F0FFF5' },
  cardLabel:  { fontSize: s(10), fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#AAAAAA', marginBottom: s(10) },

  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: s(8), paddingVertical: s(9) },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rowTitle:   { fontSize: s(13), fontWeight: '600', color: '#1A1A1A', marginBottom: s(2) },
  rowSub:     { fontSize: s(12), color: '#888', lineHeight: s(17) },
  rowArrow:   { fontSize: s(14), color: '#CCCCCC', flexShrink: 0, marginTop: s(2) },
  dot:        { width: s(8), height: s(8), borderRadius: s(4), flexShrink: 0, marginTop: s(5) },
  badge:      { borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3), flexShrink: 0 },
  badgeText:  { fontSize: s(10), fontWeight: '700' },

  safetyRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: s(10), marginBottom: s(8) },

  awareTakeCard: { backgroundColor: '#EFF6FF', borderRadius: s(16), borderWidth: 1, borderColor: '#BFDBFE', padding: s(14), marginBottom: s(10) },
  awareTakeLabel: { fontSize: s(10), fontWeight: '700', letterSpacing: 1, color: '#2563EB', textTransform: 'uppercase', marginBottom: s(8) },
  awareTakeText:  { fontSize: s(13), color: '#374151', lineHeight: s(21) },

  metricsRow: { flexDirection: 'row', gap: s(10), marginBottom: s(10) },
  metricCard: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E8EAED', borderRadius: s(16), padding: s(12) },
  metricNote: { fontSize: s(11), color: '#888', lineHeight: s(15), marginTop: s(2) },
  metricTapHint: { fontSize: s(10), color: '#AAAAAA', marginTop: s(5) },
  metricMuted: { fontSize: s(12), color: '#AAAAAA', marginTop: s(4), lineHeight: s(17) },

  nsBlock:    { flex: 1, height: s(22), borderRadius: s(4), alignItems: 'center', justifyContent: 'center' },
  nsBlockText: { fontSize: s(10), fontWeight: '800', color: '#fff' },
  novaBlock:  { width: s(28), height: s(28), borderRadius: s(6), alignItems: 'center', justifyContent: 'center' },
  novaBlockText: { fontSize: s(11), fontWeight: '800', color: '#fff' },

  nutriRow:   { flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: s(10), paddingHorizontal: s(6), borderRadius: s(8), marginBottom: s(2) },
  nutriLabel: { fontSize: s(11), color: '#999', marginBottom: s(2) },
  nutriValue: { fontSize: s(15), fontWeight: '700' },
  nutriWhat:  { fontSize: s(12), lineHeight: s(17) },
  alertDot:   { width: s(8), height: s(8), borderRadius: s(4), flexShrink: 0 },

  chipLegend: { flexDirection: 'row', gap: s(12), marginBottom: s(12), flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(5) },
  legendDot:  { width: s(8), height: s(8), borderRadius: s(4) },
  legendText: { fontSize: s(11), color: '#888' },

  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: s(8) },
  chip:       { paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: s(20), backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E8E8E8', flexDirection: 'row', alignItems: 'center', gap: s(4) },
  chipAllergen: { borderColor: '#FECACA', backgroundColor: '#FFF5F5' },
  chipConcern: { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  chipText:   { fontSize: s(12), color: '#555', maxWidth: s(140) },
  chipArrow:  { fontSize: s(12), color: '#CCCCCC' },

  feedbackBtn: { borderWidth: 1, borderColor: '#E8E8E8', borderRadius: s(20), paddingHorizontal: s(14), paddingVertical: s(7) },
  feedbackBtnText: { fontSize: s(12), color: '#AAAAAA', fontWeight: '500' },

  footer:     { alignItems: 'center', paddingTop: s(8), borderTopWidth: 1, borderTopColor: '#F0F0F0', backgroundColor: '#FFFFFF' },
  footerText: { fontSize: s(14), color: '#999', textDecorationLine: 'underline' },
  lastScannedText: { fontSize: s(10), color: '#CCCCCC', marginTop: s(2), marginBottom: s(4) },

  retryBtn:   { marginTop: s(16), paddingHorizontal: s(20), paddingVertical: s(10), backgroundColor: '#F5F5F5', borderRadius: s(12) },

  feedbackInput: { backgroundColor: '#FAFAFA', borderRadius: s(12), borderWidth: 1, borderColor: '#E0E0E0', padding: s(12), color: '#1A1A1A', fontSize: s(14), minHeight: s(100), textAlignVertical: 'top', marginBottom: s(6) },
});
