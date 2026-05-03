/**
 * ScanResultScreen — single-scroll rebuild.
 *
 * Layout (top → bottom):
 *  1. VerdictHero           — image, name, brand, verdict pill, decision sentence, NS/NOVA badges
 *  2. ForYouSection         — personalized allergen/condition warnings
 *  3. QuickStatsStrip       — tappable stat chips
 *  4. MissingDataCard       — AI fallback / retry buttons (only when data is absent)
 *  5. ConcernCards          — additive concern cards (RPC-driven, no local keyword arrays)
 *  6. FullIngredientList    — simple text list with RPC-colored dots, ALLERGEN badges
 *  7. InternationalBansSection — regulatory bans by jurisdiction
 *  8. NutritionSection      — Nutri-Score, NOVA, nutrient table
 *  9. AIInsightSection      — collapsed AI summary
 *
 * Rules:
 * - No tabs, no chip grid (bubbles).
 * - Dot colors come ONLY from RPC results (additives). No local keyword arrays.
 * - ALLERGEN badges from RPC allergenMatches + user profile (no ALLERGEN_KW).
 * - Missing data → show button, never say "check physical packaging".
 * - Product not found → show screen with button, never auto-navigate to AIFallback.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Image, Modal, TextInput,
  KeyboardAvoidingView, Linking, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { s } from '../../../shared/theme';
import { getProductById } from '../../../shared/mockData';
import { fetchProductByBarcode, fetchProductWithCategory } from '../../../shared/productCatalog';
import type { OffProductSnapshot, OffNutriments } from '../../../shared/openFoodFacts';
import { supabase, fetchUserPreferences, getCurrentUser } from '../../../shared/supabase';
import { loadAIResult, fetchCachedProduct } from '../../../shared/aiProduct';
import {
  fetchProductAnalysis, fetchAISummary, fetchSkinCareAnalysis,
  type ProductAnalysisResult, type AdditiveAnalysis, type BannedSubstanceMatch,
} from '../../../shared/scoring';
import type {
  SkinCareAnalysisResult, ProductDetectionCategory,
  BannedIngredientMatch, AllergenMatch,
} from '../../../shared/types';
import SkinSafetyTab from './tabs/SkinSafetyTab';
import {
  fmtNum, inferNovaGroup, deriveOverallVerdict,
  buildNutrientRows, inferProductSubCategory, getDecisionSummary,
  type OverallVerdict,
} from '../../../shared/awaretake';
import type { ScannerStackParamList, UserPreferences } from '../../../shared/types';
import type { OnboardingData } from '../../../shared/onboardingTypes';

type Props = NativeStackScreenProps<ScannerStackParamList, 'ScanResult'>;

// ─── Load state ───────────────────────────────────────────────────────────────

type AnalysisFailureReason = 'no_user' | 'unavailable' | null;

type LoadState =
  | { kind: 'loading'; message?: string }
  | { kind: 'error'; message: string }
  | { kind: 'not_found'; barcode: string }
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

// ─── URL safety helper ────────────────────────────────────────────────────────

function openSafeUrl(url: string | null | undefined): void {
  if (!url) return;
  if (!url.startsWith('https://') && !url.startsWith('http://')) return;
  Linking.openURL(url);
}

// ─── Verdict constants ────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<OverallVerdict, string> = {
  red: 'Avoid', yellow: 'Caution', green: 'Good',
};
const VERDICT_COLOR: Record<OverallVerdict, string> = {
  red: '#E53946', yellow: '#C98200', green: '#188A55',
};
const VERDICT_BG: Record<OverallVerdict, string> = {
  red: '#FFEDEE', yellow: '#FFF4D9', green: '#EAF7EF',
};

// ─── Severity colors ──────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  severe: '#E53946', high: '#C98200', medium: '#C98200', low: '#8C9299',
};
const SEV_BG: Record<string, string> = {
  severe: '#FFEDEE', high: '#FFF4D9', medium: '#FFF4D9', low: '#F4F4F0',
};
const SEV_LEFT: Record<string, string> = {
  severe: '#E53946', high: '#C98200', medium: '#C98200', low: '#D0D0CC',
};
const SEV_CONTEXT: Record<string, string> = {
  severe: 'Strong evidence of harm. Avoiding is recommended regardless of quantity.',
  high: 'Significant concerns backed by multiple studies. Worth limiting in your regular diet.',
  medium: 'Evidence is emerging or mixed. Safe at typical doses for most people.',
  low: 'Low concern at typical dietary exposure. Listed for transparency.',
};

const ALERT_COLOR = { red: '#E53946', amber: '#C98200', green: '#188A55', none: '#8C9299' };
const ALERT_BG    = { red: '#FFEDEE', amber: '#FFF4D9', green: '#EAF7EF', none: 'transparent' };

// ─── NOVA / Nutri-Score data ─────────────────────────────────────────────────

const NOVA_DATA: Record<number, { color: string; desc: string }> = {
  1: { color: '#16A34A', desc: 'Unprocessed or minimally processed' },
  2: { color: '#D97706', desc: 'Processed culinary ingredients' },
  3: { color: '#EA580C', desc: 'Processed foods' },
  4: { color: '#DC2626', desc: 'Ultra-processed foods' },
};
const NOVA_EXPLAIN: Record<number, { title: string; desc: string; examples: string }> = {
  1: { title: 'Unprocessed or minimally processed', desc: 'Natural foods with no or minimal industrial processing.', examples: 'Fruits, vegetables, eggs, plain meat, milk, plain grains.' },
  2: { title: 'Processed culinary ingredients', desc: 'Substances extracted from Group 1 foods, used in home cooking.', examples: 'Oils, butter, sugar, salt, flour, honey.' },
  3: { title: 'Processed foods', desc: 'Products made by adding salt, sugar, or oil to Group 1 foods.', examples: 'Canned fish, cheese, cured meats, freshly baked bread.' },
  4: { title: 'Ultra-processed foods', desc: 'Industrial formulations with 5+ ingredients. Associated with obesity, diabetes, and cardiovascular disease.', examples: 'Soft drinks, chips, candy bars, instant noodles, packaged snacks.' },
};
const NS_COLORS: Record<string, string> = {
  a: '#00843d', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63312',
};
const NS_EXPLAIN: Record<string, { desc: string; detail: string }> = {
  a: { desc: 'Excellent', detail: 'High in fibre, protein, fruits/veg. Very low in sugar, saturated fat, salt.' },
  b: { desc: 'Good', detail: 'Good balance of positive and negative nutrients.' },
  c: { desc: 'Average', detail: 'Moderate levels on both sides. Fine occasionally.' },
  d: { desc: 'Poor', detail: 'High in calories, saturated fat, sugar, or salt. Limit frequency.' },
  e: { desc: 'Very poor', detail: 'Very high in negatives with few positives. Occasional treat only.' },
};

// ─── Global ban helpers ───────────────────────────────────────────────────────

interface JurisdictionBanGroup {
  jurisdiction: string;
  flag: string;
  ingredients: string[];
  reasons: string[];
  sourceUrls: string[];
  isBanned: boolean;
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

const JURISDICTION_ORDER: Record<string, number> = {
  US: 0, EU: 1, CA: 2, GB: 3, AU: 4, DE: 5, FR: 6,
};

function groupBansByJurisdiction(items: BannedIngredientMatch[]): JurisdictionBanGroup[] {
  const map = new Map<string, { ingredients: Set<string>; reasons: string[]; sourceUrls: string[]; hasStrictBan: boolean }>();
  for (const item of items) {
    if (!map.has(item.country_code)) {
      map.set(item.country_code, { ingredients: new Set(), reasons: [], sourceUrls: [], hasStrictBan: false });
    }
    const entry = map.get(item.country_code)!;
    entry.ingredients.add(item.ingredient_name);
    if (item.ban_status === 'banned') entry.hasStrictBan = true;
    if (item.reason && !entry.reasons.includes(item.reason)) entry.reasons.push(item.reason);
    if (item.regulation_link && !entry.sourceUrls.includes(item.regulation_link))
      entry.sourceUrls.push(item.regulation_link);
  }
  return Array.from(map.entries())
    .map(([code, data]) => ({
      jurisdiction: code,
      flag: getJurisdictionFlag(code),
      ingredients: Array.from(data.ingredients),
      reasons: data.reasons,
      sourceUrls: data.sourceUrls,
      isBanned: data.hasStrictBan,
    }))
    .sort((a, b) => {
      const pa = JURISDICTION_ORDER[a.jurisdiction] ?? 99;
      const pb = JURISDICTION_ORDER[b.jurisdiction] ?? 99;
      return pa !== pb ? pa - pb : a.jurisdiction.localeCompare(b.jurisdiction);
    });
}

// ─── RPC additive map ─────────────────────────────────────────────────────────

interface AdditiveItem {
  ingredient: string;
  severity: string | null;
  reason: string | null;
  source_url?: string | null;
}

function buildAdditiveMap(
  analysis: ProductAnalysisResult | null,
): Map<string, { severity: string; reason: string | null; source_url: string | null }> {
  const map = new Map<string, { severity: string; reason: string | null; source_url: string | null }>();
  if (!analysis) return map;
  const all = [
    ...analysis.additives.severe,
    ...analysis.additives.high,
    ...analysis.additives.medium,
    ...analysis.additives.low,
  ];
  for (const item of all) {
    map.set(item.ingredient.toLowerCase(), {
      severity: item.severity ?? 'low',
      reason: item.reason ?? null,
      source_url: (item as AdditiveItem).source_url ?? null,
    });
  }
  return map;
}

// ─── Ingredient list parsing ──────────────────────────────────────────────────

function parseIngredientsList(text: string): string[] {
  if (!text?.trim()) return [];
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if ((ch === ',' || ch === ';') && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts
    .filter((p) => p.length > 0)
    .map((p) => p.replace(/\s+/g, ' ').trim());
}

// ─── Allergen detection via RPC allergenMatches (no local keyword arrays) ─────

function getIngredientAllergen(
  displayName: string,
  userAllergenCodes: string[],
  allergenMatches: AllergenMatch[],
): string | null {
  if (!userAllergenCodes.length || !allergenMatches.length) return null;
  const lower = displayName.toLowerCase();
  for (const match of allergenMatches) {
    const token = match.ingredient_name.toLowerCase();
    if (!lower.includes(token) && !(token.length > 3 && token.includes(lower))) continue;
    const code = match.allergen_code.toLowerCase();
    const dispLower = match.display_name.toLowerCase();
    const hit = userAllergenCodes.some((ua) => {
      const u = ua.toLowerCase();
      return (
        u === code || u === dispLower ||
        (u === 'dairy' && (code === 'milk' || code === 'dairy')) ||
        (u === 'milk' && (code === 'dairy' || code === 'milk')) ||
        (u === 'gluten' && (code === 'wheat' || code === 'gluten')) ||
        (u === 'wheat' && (code === 'gluten' || code === 'wheat')) ||
        (u === 'eggs' && code === 'egg') ||
        (u === 'egg' && code === 'eggs')
      );
    });
    if (hit) return match.display_name;
  }
  return null;
}

// ─── Merged allergens helper ──────────────────────────────────────────────────

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

// ─── Dot color for ingredient rows (RPC-only, no local keywords) ──────────────

function ingDotColor(severity: string | null, isAllergen: boolean): string {
  if (isAllergen) return '#DC2626';
  switch (severity) {
    case 'severe': return '#DC2626';
    case 'high':   return '#EA580C';
    case 'medium': return '#D97706';
    case 'low':    return '#9CA3AF';
    default:       return '#E5E7EB';
  }
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AdditiveDetailModal({ item, onClose }: { item: AdditiveItem | null; onClose: () => void }) {
  if (!item) return null;
  const sev = item.severity ?? 'low';
  const color = SEV_COLOR[sev] ?? '#D97706';
  const bg    = SEV_BG[sev]    ?? '#FFFBEB';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[ms.badge, { backgroundColor: bg, borderWidth: 1, borderColor: color + '55' }]}>
                <View style={[ms.badgeDot, { backgroundColor: color }]} />
                <Text style={[ms.badgeText, { color }]}>{sev.toUpperCase()} CONCERN</Text>
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
                    Source pending — building our scientific evidence library.
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

function BannedSubstanceModal({ item, onClose }: { item: BannedSubstanceMatch | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[ms.badge, { backgroundColor: '#FFEDEE', borderWidth: 1, borderColor: 'rgba(255,77,77,0.35)' }]}>
                <View style={[ms.badgeDot, { backgroundColor: '#E53946' }]} />
                <Text style={[ms.badgeText, { color: '#E53946' }]}>
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
        <View style={ms.divider} />
        {([1, 2, 3, 4] as const).map((n) => (
          <View key={n} style={[ms.novaRow, n === novaGroup && { backgroundColor: colors[n] + '15', borderRadius: s(8) }]}>
            <View style={[ms.novaNum, { backgroundColor: colors[n] }]}>
              <Text style={ms.novaNumText}>{n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ms.novaTitle, n === novaGroup && { color: colors[n] }]}>{NOVA_EXPLAIN[n].title}</Text>
              <Text style={ms.novaDesc}>{NOVA_EXPLAIN[n].desc}</Text>
              <Text style={[ms.novaDesc, { fontStyle: 'italic' }]}>{NOVA_EXPLAIN[n].examples}</Text>
            </View>
          </View>
        ))}
      </>
    );
  };

  const renderNutriscore = () => {
    if (!nutriscoreGrade) return null;
    const g = nutriscoreGrade.toLowerCase();
    const grades = ['a', 'b', 'c', 'd', 'e'] as const;
    return (
      <>
        <Text style={ms.title}>Nutri-Score</Text>
        <View style={ms.divider} />
        {grades.map((grade) => (
          <View key={grade} style={[ms.novaRow, grade === g && { backgroundColor: NS_COLORS[grade] + '15', borderRadius: s(8) }]}>
            <View style={[ms.nsGrade, { backgroundColor: NS_COLORS[grade] }]}>
              <Text style={[ms.nsGradeText, grade === 'c' && { color: '#1A1A1A' }]}>{grade.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ms.novaTitle, grade === g && { color: NS_COLORS[grade] }]}>
                {NS_EXPLAIN[grade].desc}
              </Text>
              <Text style={ms.novaDesc}>{NS_EXPLAIN[grade].detail}</Text>
            </View>
          </View>
        ))}
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

function FeedbackModal({
  visible, barcode, userId, onClose,
}: { visible: boolean; barcode: string; userId: string | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState(false);
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
      setDone(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { setText(''); setDone(false); setSubmitError(false); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={ms.overlay} onPress={handleClose}>
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
          <Pressable style={ms.sheet} onPress={() => {}}>
            <View style={ms.handle} />
            {done ? (
              <View style={{ alignItems: 'center', paddingVertical: s(24), gap: s(8) }}>
                <Text style={{ fontSize: 36 }}>✓</Text>
                <Text style={{ fontWeight: '700', fontSize: s(20), color: '#188A55' }}>Thank you</Text>
                <Text style={{ fontSize: s(13), color: '#6F747C', textAlign: 'center', lineHeight: s(20), paddingHorizontal: s(8) }}>
                  We received your report. We'll review it and update if needed.
                </Text>
              </View>
            ) : (
              <>
                <Text style={ms.title}>Something wrong?</Text>
                <Text style={[ms.body, { marginBottom: s(12) }]}>
                  Tell us what's incorrect — wrong verdict, missing ingredient, misidentified allergen.
                </Text>
                {submitError && (
                  <View style={{ backgroundColor: '#FFEDEE', borderRadius: s(8), padding: s(10), marginBottom: s(10), borderWidth: 1, borderColor: 'rgba(229,57,70,0.2)' }}>
                    <Text style={{ color: '#E53946', fontSize: s(13) }}>
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
              style={[ms.doneBtn, done && { backgroundColor: 'rgba(46,213,115,0.10)', borderWidth: 1, borderColor: 'rgba(46,213,115,0.30)' },
                (!canSubmit && !done) && { opacity: 0.5 }]}
              onPress={done ? handleClose : submit}
              disabled={!canSubmit && !done}
            >
              <Text style={[ms.doneBtnText, done && { color: '#188A55' }]}>
                {done ? 'Close' : submitting ? 'Sending…' : submitError ? 'Try again' : text.trim().length === 0 ? 'Describe the issue' : 'Send report'}
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── 1. VerdictHero ───────────────────────────────────────────────────────────

const VERDICT_LINE1: Record<OverallVerdict, string> = {
  green: 'Great', yellow: 'Use', red: 'Best',
};
const VERDICT_LINE2: Record<OverallVerdict, string> = {
  green: 'choice', yellow: 'occasionally', red: 'avoided',
};

function VerdictHero({
  off, verdict, analysis, effectiveNova, detectedCategory, isAI,
  dataMismatch, hallucinationDetected,
  onNSPress, onNOVAPress,
}: {
  off: OffProductSnapshot;
  verdict: OverallVerdict;
  analysis: ProductAnalysisResult | null;
  effectiveNova: number | null;
  detectedCategory: ProductDetectionCategory;
  isAI: boolean;
  dataMismatch: boolean;
  hallucinationDetected: boolean;
  onNSPress: () => void;
  onNOVAPress: () => void;
}) {
  const isSkincare = detectedCategory === 'skincare';
  const accentColor = isSkincare ? '#A78BFA' : VERDICT_COLOR[verdict];
  const bgColor     = isSkincare ? '#F5F0FF'  : VERDICT_BG[verdict];
  const borderColor = isSkincare ? 'rgba(167,139,250,0.15)' : `${VERDICT_COLOR[verdict]}1F`;

  const nsGrade = off.nutriscoreGrade?.toLowerCase();
  const novaInferred = !off.novaGroup && effectiveNova !== null;
  const addHighCount = (analysis?.additives.severe.length ?? 0) + (analysis?.additives.high.length ?? 0);
  const totalAdd = analysis?.additives.total ?? 0;
  const energyPer100 = off.nutriments?.energy_kcal_100g ?? null;
  const sugarPer100 = off.nutriments?.sugars_100g ?? null;

  return (
    <>
      {/* ── Product header card ── */}
      <View style={styles.productHeaderCard}>
        {off.imageUrl ? (
          <Image source={{ uri: off.imageUrl }} style={styles.heroImage} resizeMode="contain" />
        ) : (
          <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
            <Text style={{ fontSize: s(36) }}>📦</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          {!!off.brand && <Text style={styles.heroBrand}>{off.brand.toUpperCase()}</Text>}
          <Text style={styles.heroName} numberOfLines={2}>{off.productName}</Text>
          <Text style={styles.heroBarcode}>{off.code}</Text>
          {!isSkincare && totalAdd > 0 && (
            <View style={[styles.flaggedPill, { backgroundColor: VERDICT_BG[verdict], borderColor: `${VERDICT_COLOR[verdict]}33` }]}>
              <Text style={[styles.flaggedPillText, { color: VERDICT_COLOR[verdict] }]}>
                {addHighCount > 0 ? `⚠️ ${addHighCount} ingredient${addHighCount > 1 ? 's' : ''} flagged` : `${totalAdd} additive${totalAdd > 1 ? 's' : ''} found`}
              </Text>
            </View>
          )}
        </View>
        {isAI && (
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>🤖 AI</Text>
          </View>
        )}
      </View>

      {/* ── Verdict card ── */}
      {!isSkincare && (
        <View style={[styles.verdictHero, { backgroundColor: bgColor, borderColor }]}>
          <Text style={[styles.verdictLabel, { color: accentColor }]}>AWARE VERDICT</Text>
          <View style={styles.verdictRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.verdictLine1}>{VERDICT_LINE1[verdict]}</Text>
              <Text style={[styles.verdictLine2, { color: accentColor }]}>{VERDICT_LINE2[verdict]}</Text>
              <Text style={styles.verdictDecision}>
                {getDecisionSummary(analysis, effectiveNova, off.nutriscoreGrade)}
              </Text>
            </View>
            {/* Circular score ring */}
            <View style={[styles.scoreRing, { borderColor: `${accentColor}40` }]}>
              <View style={[styles.scoreRingInner, { borderColor: accentColor }]} />
              <Text style={[styles.scoreRingEmoji]}>
                {verdict === 'green' ? '💚' : verdict === 'yellow' ? '🤍' : '❤️'}
              </Text>
            </View>
          </View>

          {/* Quick stats */}
          <View style={styles.verdictQuickStats}>
            {sugarPer100 != null && (
              <View style={[styles.verdictStatChip, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                <Text style={styles.verdictStatValue}>{sugarPer100.toFixed(1)}g</Text>
                <Text style={styles.verdictStatLabel}>Sugar/100g</Text>
              </View>
            )}
            {energyPer100 != null && (
              <View style={[styles.verdictStatChip, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                <Text style={styles.verdictStatValue}>{Math.round(energyPer100)} kcal</Text>
                <Text style={styles.verdictStatLabel}>Energy/100g</Text>
              </View>
            )}
            <View style={[styles.verdictStatChip, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              {(analysis?.safety?.allergenConflicts?.length ?? 0) > 0
                ? <Text style={[styles.verdictStatValue, { color: '#E53946', fontSize: s(10) }]}>⚠️ Conflict</Text>
                : <Text style={styles.verdictStatValue}>✓</Text>
              }
              <Text style={styles.verdictStatLabel}>Allergens</Text>
            </View>
          </View>

          {/* NS + NOVA */}
          {(nsGrade || !!effectiveNova) && (
            <View style={[styles.herosBadgeRow, { marginTop: s(10) }]}>
              {nsGrade && (
                <Pressable onPress={onNSPress} style={[styles.scoreBadge, { backgroundColor: NS_COLORS[nsGrade] ?? '#999' }]}>
                  <Text style={styles.scoreBadgeText}>NS {nsGrade.toUpperCase()}</Text>
                </Pressable>
              )}
              {!!effectiveNova && (
                <Pressable onPress={onNOVAPress} style={[styles.scoreBadge, { backgroundColor: NOVA_DATA[effectiveNova]?.color ?? '#999', opacity: novaInferred ? 0.75 : 1 }]}>
                  <Text style={styles.scoreBadgeText}>NOVA {effectiveNova}{novaInferred ? '~' : ''}</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Data quality warnings */}
          {hallucinationDetected && (
            <Text style={styles.heroNotice}>⚠ Unusual ingredient data detected — verify with AI analysis below.</Text>
          )}
          {dataMismatch && !hallucinationDetected && (
            <Text style={styles.heroNotice}>
              ⚠ {(off.dataWarnings ?? ['Ingredient list may be in a non-English language.']).join(' ')}
            </Text>
          )}
        </View>
      )}

      {/* Skincare verdict pill (keep existing style) */}
      {isSkincare && (
        <View style={[styles.verdictHero, { backgroundColor: bgColor, borderColor, borderLeftWidth: 4, borderLeftColor: accentColor }]}>
          <View style={styles.heroIdentityRow}>
            <View style={[styles.verdictPill, { backgroundColor: accentColor + '22', borderWidth: 1.5, borderColor: accentColor }]}>
              <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: accentColor }} />
              <Text style={[styles.verdictPillText, { color: accentColor }]}>{VERDICT_LABEL[verdict]}</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

// ─── 2. ForYouSection ─────────────────────────────────────────────────────────

function ForYouSection({
  analysis, userId,
}: {
  analysis: ProductAnalysisResult | null;
  userId: string | null;
}) {
  const allergenConflicts = analysis?.safety?.allergenConflicts ?? [];
  const avoidList = analysis?.safety?.avoidList ?? [];
  const cautionList = analysis?.safety?.cautionList ?? [];

  const hasPersonalized = allergenConflicts.length > 0 || avoidList.length > 0 || cautionList.length > 0;

  if (!userId && !hasPersonalized) {
    return (
      <View style={[styles.card, styles.cardBlue]}>
        <Text style={styles.cardLabel}>FOR YOU</Text>
        <Text style={{ fontSize: s(13), color: '#60A5FA', lineHeight: s(20) }}>
          Set up your health profile to see personalized allergen and condition warnings for every product you scan.
        </Text>
      </View>
    );
  }

  if (!hasPersonalized) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>FOR YOU</Text>
      {allergenConflicts.map((a, i) => (
        <View key={i} style={[styles.forYouRow, { borderLeftColor: '#E53946', backgroundColor: '#FFEDEE' }]}>
          <Text style={styles.forYouIcon}>🚫</Text>
          <Text style={styles.forYouText}>
            Contains <Text style={{ fontWeight: '700', color: '#E53946' }}>{a}</Text>. Not safe for you.
          </Text>
        </View>
      ))}
      {avoidList.map((item, i) => (
        <View key={i} style={[styles.forYouRow, { borderLeftColor: '#E53946', backgroundColor: '#FFEDEE' }]}>
          <Text style={styles.forYouIcon}>🚫</Text>
          <Text style={styles.forYouText}>
            Contains <Text style={{ fontWeight: '700', color: '#E53946' }}>{item.ingredient}</Text>.
            {item.reason ? ` ${item.reason}` : ' Not recommended for your conditions.'}
          </Text>
        </View>
      ))}
      {cautionList.map((item, i) => (
        <View key={i} style={[styles.forYouRow, { borderLeftColor: '#C98200', backgroundColor: '#FFF4D9' }]}>
          <Text style={styles.forYouIcon}>⚠</Text>
          <Text style={styles.forYouText}>
            Not recommended for <Text style={{ fontWeight: '700', color: '#C98200' }}>{item.reason ?? 'your condition'}</Text>.
            Contains {item.ingredient}.
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── 3. QuickStatsStrip ───────────────────────────────────────────────────────

function QuickStatsStrip({
  analysis, off, effectiveNova,
  onScrollToConcerns, onScrollToBans, onScrollToNutrition,
}: {
  analysis: ProductAnalysisResult | null;
  off: OffProductSnapshot;
  effectiveNova: number | null;
  onScrollToConcerns: () => void;
  onScrollToBans: () => void;
  onScrollToNutrition: () => void;
}) {
  const addTotal = analysis?.additives.total ?? 0;
  const highCount = (analysis?.additives.severe.length ?? 0) + (analysis?.additives.high.length ?? 0);
  const banCount  = (analysis?.globalBans?.bannedIngredients.length ?? 0) +
                   (analysis?.bannedSubstances?.length ?? 0);
  const isSafe    = analysis !== null && analysis.safety.allergenConflicts.length === 0 &&
                   analysis.safety.avoidList.length === 0;
  const nsGrade   = off.nutriscoreGrade;

  return (
    <View style={styles.statsStrip}>
      {addTotal > 0 && (
        <Pressable
          style={[styles.statChip, { backgroundColor: highCount > 0 ? '#FFEDEE' : '#FFF4D9', borderColor: highCount > 0 ? 'rgba(255,77,77,0.3)' : 'rgba(255,184,48,0.3)' }]}
          onPress={onScrollToConcerns}
        >
          <Text style={[styles.statChipText, { color: highCount > 0 ? '#E53946' : '#C98200' }]}>
            ⚠ {addTotal} additive{addTotal !== 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}
      {banCount > 0 && (
        <Pressable style={[styles.statChip, { backgroundColor: '#FFEDEE', borderColor: 'rgba(255,77,77,0.3)' }]} onPress={onScrollToBans}>
          <Text style={[styles.statChipText, { color: '#E53946' }]}>
            🌍 {banCount} restriction{banCount !== 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}
      {isSafe && addTotal === 0 && (
        <View style={[styles.statChip, { backgroundColor: '#061608', borderColor: 'rgba(46,213,115,0.3)' }]}>
          <Text style={[styles.statChipText, { color: '#188A55' }]}>🛡 Safe for you</Text>
        </View>
      )}
      {nsGrade && (
        <Pressable style={[styles.statChip, { backgroundColor: (NS_COLORS[nsGrade.toLowerCase()] ?? '#555') + '22', borderColor: (NS_COLORS[nsGrade.toLowerCase()] ?? '#555') + '44' }]} onPress={onScrollToNutrition}>
          <Text style={[styles.statChipText, { color: NS_COLORS[nsGrade.toLowerCase()] ?? '#aaa' }]}>
            📊 NS: {nsGrade.toUpperCase()}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── 4. MissingDataCard ───────────────────────────────────────────────────────

function MissingDataCard({
  off, barcode, analysisFailureReason, onRetry, navigation,
}: {
  off: OffProductSnapshot;
  barcode: string;
  analysisFailureReason: AnalysisFailureReason;
  onRetry: () => void;
  navigation: Props['navigation'];
}) {
  const hasIngredients = !!off.ingredientsText?.trim();
  const aiCategory: ProductDetectionCategory =
    off.detectedCategory === 'skincare' ? 'skincare' : 'food';

  if (analysisFailureReason === 'unavailable') {
    return (
      <View style={styles.missingCard}>
        <Text style={styles.missingCardTitle}>Analysis unavailable</Text>
        <Text style={styles.missingCardBody}>
          The ingredient analysis service is temporarily unreachable. Try again in a moment.
        </Text>
        <Pressable style={styles.missingCardBtn} onPress={onRetry}>
          <Text style={styles.missingCardBtnText}>🔄 RETRY ANALYSIS</Text>
        </Pressable>
      </View>
    );
  }

  if (!hasIngredients) {
    return (
      <View style={styles.missingCard}>
        <Text style={styles.missingCardTitle}>No ingredient list found</Text>
        <Text style={styles.missingCardBody}>
          {off.catalogSource === 'usda_fdc'
            ? 'USDA FoodData Central has this product but no ingredient text.'
            : `${off.catalogSourceLabel ?? 'This database'} doesn't have ingredient data for this barcode.`}
        </Text>
        <Pressable
          style={[styles.missingCardBtn, { backgroundColor: '#1D4ED8' }]}
          onPress={() => navigation.replace('AIFallback', { barcode, category: aiCategory })}
        >
          <Text style={[styles.missingCardBtnText, { color: '#FFF' }]}>📷 ANALYZE INGREDIENTS WITH AI</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

// ─── 5. ConcernCards ─────────────────────────────────────────────────────────

function ConcernCards({
  additives, onSelect,
}: {
  additives: AdditiveAnalysis | null;
  onSelect: (item: AdditiveItem) => void;
}) {
  const allItems: AdditiveItem[] = additives ? [
    ...additives.severe,
    ...additives.high,
    ...additives.medium,
    ...additives.low,
  ] : [];

  if (additives === null) return null;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>INGREDIENT CONCERNS</Text>
      {allItems.length === 0 ? (
        <View style={[styles.card, { paddingVertical: s(14) }]}>
          <Text style={{ fontSize: s(13), color: '#188A55', fontWeight: '600' }}>✅ No flagged ingredients.</Text>
        </View>
      ) : (
        allItems.map((item, i) => {
          const sev = item.severity ?? 'low';
          const leftColor = SEV_LEFT[sev] ?? '#D1D5DB';
          const bg        = SEV_BG[sev]    ?? '#FAFAFA';
          return (
            <Pressable
              key={i}
              style={[styles.concernCard, { borderLeftColor: leftColor, backgroundColor: bg }]}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.ingredient}, ${sev} concern. Tap for details.`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.concernIngredient, { color: SEV_COLOR[sev] ?? '#374151' }]}>
                  {item.ingredient}
                </Text>
                {!!item.reason && (
                  <Text style={styles.concernReason} numberOfLines={2}>{item.reason}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: s(4) }}>
                <View style={[styles.sevPill, { backgroundColor: leftColor + '22', borderColor: leftColor + '55' }]}>
                  <Text style={[styles.sevPillText, { color: SEV_COLOR[sev] ?? '#555' }]}>{sev.toUpperCase()}</Text>
                </View>
                {item.source_url && (
                  <Pressable onPress={(e) => { e.stopPropagation(); openSafeUrl(item.source_url); }} hitSlop={8}>
                    <Text style={styles.sourceLink}>Source ↗</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

// ─── 6. FullIngredientList ────────────────────────────────────────────────────

function FullIngredientList({
  off, analysis, userAllergens,
}: {
  off: OffProductSnapshot;
  analysis: ProductAnalysisResult | null;
  userAllergens: string[];
}) {
  const ingredients = useMemo(() => parseIngredientsList(off.ingredientsText ?? ''), [off.ingredientsText]);
  const additiveMap = useMemo(() => buildAdditiveMap(analysis), [analysis]);
  const allergenMatches = useMemo(() => analysis?.allergenMatches ?? [], [analysis]);

  if (!off.ingredientsText?.trim()) return null;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>FULL INGREDIENT LIST</Text>
      <View style={styles.card}>
        {ingredients.length === 0 ? (
          <Text style={{ fontSize: s(13), color: '#374151', lineHeight: s(20) }}>
            {off.ingredientsText}
          </Text>
        ) : (
          ingredients.map((name, i) => {
            const lower = name.toLowerCase();
            // Find severity from RPC additive map (no local keywords)
            let severity: string | null = null;
            let matchedReason: string | null = null;
            let matchedUrl: string | null = null;
            for (const [key, data] of additiveMap) {
              if (lower.includes(key) || key.includes(lower.replace(/[()]/g, '').trim())) {
                severity = data.severity;
                matchedReason = data.reason;
                matchedUrl = data.source_url;
                break;
              }
            }
            // Check allergen from RPC results + user profile (no local keyword arrays)
            const allergenName = getIngredientAllergen(name, userAllergens, allergenMatches);
            const isAllergen = !!allergenName;
            if (isAllergen && !severity) severity = 'high';

            const dotColor = ingDotColor(severity, isAllergen);
            const isFlagged = severity !== null || isAllergen;

            return (
              <View
                key={i}
                style={[styles.ingRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#F4F4F0' }]}
              >
                <View style={[styles.ingDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.ingName, isFlagged && { fontWeight: '600', color: '#101418' }]}>
                  {name}
                </Text>
                {isAllergen && (
                  <View style={styles.allergenBadge}>
                    <Text style={styles.allergenBadgeText}>ALLERGEN</Text>
                  </View>
                )}
                {!isAllergen && severity && severity !== 'low' && (
                  <View style={[styles.sevPillSmall, { backgroundColor: (SEV_COLOR[severity] ?? '#D97706') + '22' }]}>
                    <Text style={[styles.sevPillSmallText, { color: SEV_COLOR[severity] ?? '#D97706' }]}>
                      {severity.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

// ─── 7. InternationalBansSection ─────────────────────────────────────────────

function InternationalBansSection({
  analysis, onBannedSelect,
}: {
  analysis: ProductAnalysisResult | null;
  onBannedSelect: (item: BannedSubstanceMatch) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const banned     = analysis?.bannedSubstances ?? [];
  const legacyNames = useMemo(() => new Set(banned.map((b) => b.substanceName.toLowerCase())), [banned]);
  const globalBans  = useMemo(
    () => (analysis?.globalBans?.bannedIngredients ?? []).filter(
      (b) => !legacyNames.has(b.ingredient_name.toLowerCase()),
    ),
    [analysis, legacyNames],
  );
  const jurisdictionGroups = useMemo(() => groupBansByJurisdiction(globalBans), [globalBans]);
  const totalItems = banned.length + jurisdictionGroups.length;

  if (analysis === null) return null;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>INTERNATIONAL RESTRICTIONS</Text>
      {totalItems === 0 ? (
        <View style={[styles.card, { paddingVertical: s(14) }]}>
          <Text style={{ fontSize: s(13), color: '#188A55', fontWeight: '600' }}>✅ No international restrictions.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {/* Legacy banned substances */}
          {banned.map((item, i) => (
            <Pressable
              key={`legacy-${i}`}
              style={[styles.banRow, i > 0 && styles.banRowBorder]}
              onPress={() => onBannedSelect(item)}
            >
              <Text style={{ fontSize: s(18), flexShrink: 0 }}>🚫</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.banName, { color: '#DC2626' }]}>{item.substanceName}</Text>
                <Text style={styles.banSub}>
                  {item.jurisdictions.slice(0, 3).join(', ')}{item.jurisdictions.length > 3 ? ` +${item.jurisdictions.length - 3}` : ''}
                </Text>
              </View>
              <View style={styles.banBadge}>
                <Text style={styles.banBadgeText}>BANNED</Text>
              </View>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          ))}

          {/* Global bans — collapsed by default */}
          {jurisdictionGroups.length > 0 && (
            <Pressable
              style={[styles.banRow, banned.length > 0 && styles.banRowBorder]}
              onPress={() => setExpanded((v) => !v)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.banName}>
                  {jurisdictionGroups.slice(0, 4).map((g) => `${g.flag} ${g.jurisdiction}`).join('  ')}
                  {jurisdictionGroups.length > 4 ? ` +${jurisdictionGroups.length - 4} more` : ''}
                </Text>
                <Text style={styles.banSub}>
                  {[...new Set(globalBans.map((b) => b.ingredient_name))].slice(0, 3).join(', ')}
                </Text>
              </View>
              <Text style={{ fontSize: s(11), color: '#DC2626' }}>
                {expanded ? 'Less ▲' : 'Details ▼'}
              </Text>
            </Pressable>
          )}

          {expanded && jurisdictionGroups.map((group, i) => {
            const ingDisplay = group.ingredients.length <= 3
              ? group.ingredients.join(', ')
              : `${group.ingredients.slice(0, 2).join(', ')} +${group.ingredients.length - 2} more`;
            return (
              <View key={i} style={[styles.banRow, styles.banRowBorder]}>
                <Text style={{ fontSize: s(18), flexShrink: 0, lineHeight: s(22), marginTop: s(2) }}>
                  {group.flag}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.banName, { color: group.isBanned ? '#DC2626' : '#D97706' }]}>
                    {group.isBanned ? 'Banned' : 'Restricted'} in {group.jurisdiction}
                  </Text>
                  <Text style={styles.banSub} numberOfLines={2}>{ingDisplay}</Text>
                  {group.reasons[0] && (
                    <Text style={[styles.banSub, { fontStyle: 'italic', marginTop: s(2) }]} numberOfLines={2}>
                      {group.reasons[0]}
                    </Text>
                  )}
                </View>
                {group.sourceUrls[0] && (
                  <Pressable onPress={() => openSafeUrl(group.sourceUrls[0])} hitSlop={8}>
                    <Text style={styles.sourceLink}>Source ↗</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── 8. NutritionSection ─────────────────────────────────────────────────────

function NutritionSection({
  off, effectiveNova, onNSPress, onNOVAPress,
}: {
  off: OffProductSnapshot;
  effectiveNova: number | null;
  onNSPress: () => void;
  onNOVAPress: () => void;
}) {
  const nm = off.nutriments;
  const subCat = useMemo(() => inferProductSubCategory(off, effectiveNova), [off, effectiveNova]);
  const nutrientRows = useMemo(
    () => nm ? buildNutrientRows(nm, effectiveNova, subCat) : [],
    [nm, effectiveNova, subCat],
  );
  const nsGrade = off.nutriscoreGrade?.toLowerCase();
  const novaInferred = !off.novaGroup && effectiveNova !== null;

  if (!nm && !nsGrade && !effectiveNova) return null;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>NUTRITION</Text>

      {/* NS + NOVA row */}
      <View style={styles.nutriBadgeRow}>
        {nsGrade && (
          <Pressable onPress={onNSPress} style={[styles.nutriMetric, { borderColor: NS_COLORS[nsGrade] + '55' }]}>
            <Text style={[styles.nutriMetricVal, { color: NS_COLORS[nsGrade] }]}>{nsGrade.toUpperCase()}</Text>
            <Text style={styles.nutriMetricLabel}>Nutri-Score{'\n'}Tap to learn more</Text>
          </Pressable>
        )}
        {!!effectiveNova && (
          <Pressable onPress={onNOVAPress} style={[styles.nutriMetric, { borderColor: (NOVA_DATA[effectiveNova]?.color ?? '#999') + '55' }]}>
            <Text style={[styles.nutriMetricVal, { color: NOVA_DATA[effectiveNova]?.color ?? '#999' }]}>
              {effectiveNova}{novaInferred ? '~' : ''}
            </Text>
            <Text style={styles.nutriMetricLabel}>
              {`NOVA ${effectiveNova}${novaInferred ? ' (est.)' : ''}`}{'\n'}
              {NOVA_DATA[effectiveNova]?.desc}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Per-100g table */}
      {nm ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PER 100g — WHAT THIS MEANS</Text>
          {nutrientRows.map((row, i, arr) => (
            <View
              key={row.label}
              style={[
                styles.nutriRow,
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F4F4F0' },
                row.alert !== 'none' && { backgroundColor: ALERT_BG[row.alert], borderRadius: s(6), paddingHorizontal: s(6) },
              ]}
            >
              <View style={{ width: s(90) }}>
                <Text style={styles.nutriLabel}>{row.label}</Text>
                <Text style={[styles.nutriValue, { color: row.alert !== 'none' ? ALERT_COLOR[row.alert] : '#101418' }]}>
                  {row.value !== null ? `${fmtNum(row.value)}${row.unit}` : '—'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nutriWhat, { color: row.alert !== 'none' ? ALERT_COLOR[row.alert] : '#8C9299' }]}>
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
          <Text style={{ fontSize: s(13), color: '#8C9299', lineHeight: s(20) }}>
            Detailed nutrition data is not available for this product.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── 9. AIInsightSection ──────────────────────────────────────────────────────

function AIInsightSection({ aiSummary }: { aiSummary: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!aiSummary) return null;

  return (
    <View style={styles.sectionBlock}>
      <Pressable
        style={[styles.card, { paddingVertical: s(12) }]}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse AI insight' : 'Expand AI insight'}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.cardLabel}>🤖 AI INSIGHT</Text>
          <Text style={{ fontSize: s(12), color: '#8C9299' }}>{expanded ? '▲' : '▼'}</Text>
        </View>
        {expanded && (
          <Text style={{ fontSize: s(13), color: '#6F747C', lineHeight: s(21), marginTop: s(8) }}>
            {aiSummary}
          </Text>
        )}
        {!expanded && (
          <Text style={{ fontSize: s(12), color: '#8C9299', marginTop: s(4) }}>
            Tap to read the AI-generated summary
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Community contribution card ──────────────────────────────────────────────

type ContributeStep = 'idle' | 'picking_front' | 'picking_label' | 'uploading' | 'done' | 'error';

function CommunityContributeCard({ barcode }: { barcode: string }) {
  const [step, setStep] = useState<ContributeStep>('idle');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [labelUri, setLabelUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return lib.status === 'granted';
    }
    return true;
  };

  const pickImage = async (label: 'front' | 'label'): Promise<string | null> => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.75,
    }).catch(async () =>
      // Camera unavailable (simulator/web) — fall back to library
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 })
    );
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  };

  const uploadUri = async (uri: string, path: string): Promise<string> => {
    if (!supabase) throw new Error('Supabase not configured');
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const { error } = await supabase.storage
      .from('community-submissions')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    const { data: urlData } = supabase.storage
      .from('community-submissions')
      .getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleContribute = async () => {
    setErrorMsg(null);
    const ok = await requestPermission();
    if (!ok) {
      setErrorMsg('Camera or photo library permission is required.');
      return;
    }

    // Step 1: front photo
    setStep('picking_front');
    const front = await pickImage('front');
    if (!front) { setStep('idle'); return; }
    setFrontUri(front);

    // Step 2: label photo
    setStep('picking_label');
    const label = await pickImage('label');
    if (!label) { setStep('idle'); return; }
    setLabelUri(label);

    // Step 3: upload both
    setStep('uploading');
    try {
      const uid = Math.random().toString(36).slice(2, 10);
      const [frontUrl, labelUrl] = await Promise.all([
        uploadUri(front,  `${barcode}/${uid}-front.jpg`),
        uploadUri(label,  `${barcode}/${uid}-label.jpg`),
      ]);

      const { error: dbErr } = await supabase!
        .from('community_submissions')
        .insert({
          barcode,
          user_id: null,
          front_image_url: frontUrl,
          label_image_url: labelUrl,
          status: 'pending',
        });
      if (dbErr) throw new Error(dbErr.message);

      setStep('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed — please try again.');
      setStep('error');
    }
  };

  if (step === 'done') {
    return (
      <View style={[styles.card, { borderColor: 'rgba(46,213,115,0.3)', backgroundColor: '#051A0A', marginHorizontal: s(16), marginTop: s(8) }]}>
        <Text style={{ fontSize: s(14), fontWeight: '700', color: '#188A55', marginBottom: s(4) }}>
          ✅ Photos submitted — thank you!
        </Text>
        <Text style={{ fontSize: s(12), color: 'rgba(46,213,115,0.7)', lineHeight: s(18) }}>
          Our team will review and add this product so the whole community can scan it.
        </Text>
      </View>
    );
  }

  const isCapturing = step === 'picking_front' || step === 'picking_label' || step === 'uploading';
  const stepLabel =
    step === 'picking_front' ? '📸 Taking front photo…' :
    step === 'picking_label' ? '📸 Taking ingredients label photo…' :
    step === 'uploading'     ? '⬆️ Uploading…' :
    'Contribute photos (2 photos)';

  return (
    <View style={[styles.card, { borderColor: 'rgba(96,165,250,0.3)', backgroundColor: '#080F1A', marginHorizontal: s(16), marginTop: s(8) }]}>
      <Text style={{ fontSize: s(14), fontWeight: '700', color: '#60A5FA', marginBottom: s(6) }}>
        📸 Help us add this product
      </Text>
      <Text style={{ fontSize: s(12), color: 'rgba(96,165,250,0.7)', lineHeight: s(18), marginBottom: s(10) }}>
        Take a photo of the front label, then the ingredients label. We'll add it to the database so everyone can scan it.
      </Text>
      {frontUri && step === 'picking_label' && (
        <View style={{ marginBottom: s(8) }}>
          <Text style={{ fontSize: s(11), color: '#188A55', fontWeight: '600' }}>✓ Front photo captured</Text>
          <Text style={{ fontSize: s(11), color: '#60A5FA', marginTop: s(2) }}>Now take the ingredients label photo.</Text>
        </View>
      )}
      {!!errorMsg && (
        <Text style={{ fontSize: s(11), color: '#E53946', marginBottom: s(8) }}>{errorMsg}</Text>
      )}
      <Pressable
        style={[
          { backgroundColor: '#1D4ED8', borderRadius: s(8), paddingVertical: s(9), alignItems: 'center' },
          isCapturing && { opacity: 0.6 },
        ]}
        onPress={handleContribute}
        disabled={isCapturing}
      >
        {isCapturing
          ? <ActivityIndicator size="small" color="#FFF" />
          : <Text style={{ color: '#FFF', fontSize: s(13), fontWeight: '700' }}>{stepLabel}</Text>
        }
      </Pressable>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScanResultScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { productId, barcode, category: routeCategory } = route.params ?? {};
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [additiveModal, setAdditiveModal] = useState<AdditiveItem | null>(null);
  const [bannedModal, setBannedModal] = useState<BannedSubstanceMatch | null>(null);

  // Refs for scroll-to-section
  const scrollRef = useRef<ScrollView>(null);
  const concernsY = useRef(0);
  const bansY     = useRef(0);
  const nutritionY = useRef(0);

  const load = useCallback(async () => {
    if (barcode) {
      const digits = barcode.replace(/\D/g, '');
      const validLengths = [6, 7, 8, 12, 13, 14];
      if (!validLengths.includes(digits.length)) {
        // Invalid barcode length — show not_found, let user choose AI fallback
        setState({ kind: 'not_found', barcode });
        return;
      }

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

      // 1. Supabase cache (fastest)
      const cached = await fetchCachedProduct(barcode);
      if (cached?.ok) {
        snapshot = cached.product;
        if (!routeCategory && snapshot.detectedCategory && snapshot.detectedCategory !== 'unknown') {
          detectedCategory = snapshot.detectedCategory;
        }
      }

      // 2. External product databases (USDA → OFF → OBF → OPF → FDA)
      if (!snapshot) {
        const isSkincare = detectedCategory === 'skincare';
        const res = isSkincare
          ? await fetchProductWithCategory(barcode)
          : await fetchProductByBarcode(barcode);
        if (res.ok) snapshot = res.product;
      }

      // 3. Local AI cache (previously scanned via AI)
      if (!snapshot) {
        const ai = await loadAIResult(barcode);
        if (ai) {
          snapshot = ai;
          if (!routeCategory && snapshot.detectedCategory && snapshot.detectedCategory !== 'unknown') {
            detectedCategory = snapshot.detectedCategory;
          }
        }
      }

      // Product genuinely not found — show not_found screen with AI button
      if (!snapshot) {
        setState({ kind: 'not_found', barcode });
        return;
      }

      const isSkincare = detectedCategory === 'skincare';
      const conditions = ((prefs?.healthConditions as string[] | undefined) ?? []);

      let analysis: ProductAnalysisResult | null = null;
      let analysisFailureReason: AnalysisFailureReason = null;
      let skincareAnalysis: SkinCareAnalysisResult | null = null;

      if (isSkincare) {
        skincareAnalysis = await fetchSkinCareAnalysis(snapshot.ingredientsText, userId).catch(() => null);
      } else {
        try {
          analysis = await fetchProductAnalysis(barcode, userId, snapshot.ingredientsText, detectedCategory);
          if (analysis === null) analysisFailureReason = 'unavailable';
        } catch {
          analysisFailureReason = 'unavailable';
        }
      }

      const aiSummary = isSkincare ? null : await fetchAISummary(
        barcode, userId, snapshot.productName, snapshot.ingredientsText, conditions,
      ).catch(() => null);

      let lastScannedAt: string | null = null;
      if (supabase && userId) {
        try {
          const { data: scanRow } = await supabase
            .from('scanned_history')
            .select('scanned_at')
            .eq('user_id', userId)
            .eq('barcode', barcode)
            .order('scanned_at', { ascending: false })
            .limit(2);
          const previousScan = scanRow && scanRow.length > 1 ? scanRow[1] : (scanRow?.[0] ?? null);
          lastScannedAt = previousScan?.scanned_at ?? null;
        } catch {
          // non-critical
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
          ? (analysis.safety.allergenConflicts.length > 0 || analysis.bannedSubstances.length > 0 || globalBanCount > 0 ? 'red'
            : analysis.safety.avoidList.length > 0 || analysis.additives.severe.length > 0 ? 'red'
            : analysis.safety.cautionList.length > 0 || analysis.additives.high.length > 0 ? 'yellow'
            : 'green')
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

  const effectiveNova = useMemo(
    () => state.kind === 'off' ? inferNovaGroup(state.off) : null,
    [state],
  );
  const userAllergens = useMemo(
    () => state.kind === 'off' ? buildMergedAllergens(state.prefs, state.obData) : [],
    [state],
  );

  // ─── Header ────────────────────────────────────────────────────────────────

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={s(24)} color="#101418" />
      </Pressable>
      <Text style={styles.headerTitle}>Scan result</Text>
      <View style={{ width: s(40) }} />
    </View>
  );

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (state.kind === 'loading') {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B5E52" />
          <Text style={{ fontSize: s(15), color: '#6F747C', marginTop: s(12) }}>
            {state.message ?? 'Analysing product…'}
          </Text>
        </View>
      </View>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (state.kind === 'error') {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <Text style={{ fontSize: s(48) }}>🔍</Text>
          <Text style={{ fontSize: s(18), fontWeight: '700', color: '#101418', textAlign: 'center', marginTop: s(12) }}>
            {state.message}
          </Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.retryBtn}>
            <Text style={{ fontSize: s(15), color: '#6F747C' }}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Not found — show AI button, don't auto-navigate ──────────────────────

  if (state.kind === 'not_found') {
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={{ padding: s(16), paddingBottom: s(40) }}>
          <View style={{ alignItems: 'center', paddingVertical: s(32) }}>
            <Text style={{ fontSize: s(48) }}>📦</Text>
            <Text style={{ fontSize: s(18), fontWeight: '700', color: '#101418', textAlign: 'center', marginTop: s(12) }}>
              Product not found
            </Text>
            <Text style={{ fontSize: s(14), color: '#6F747C', textAlign: 'center', lineHeight: s(22), marginTop: s(8), paddingHorizontal: s(16) }}>
              Barcode {state.barcode} wasn't found in USDA, Open Food Facts, or Open Beauty Facts.
            </Text>
          </View>

          <Pressable
            style={[styles.missingCardBtn, { marginHorizontal: 0 }]}
            onPress={() => navigation.replace('AIFallback', { barcode: state.barcode, category: routeCategory ?? 'food' })}
          >
            <Text style={[styles.missingCardBtnText, { color: '#FFF' }]}>📷 ANALYZE WITH AI</Text>
          </Pressable>

          <View style={{ height: s(16) }} />

          <CommunityContributeCard barcode={state.barcode} />

          <Pressable onPress={() => navigation.goBack()} style={[styles.retryBtn, { marginTop: s(16) }]}>
            <Text style={{ fontSize: s(15), color: '#888' }}>Go back</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ─── Mock catalog product ─────────────────────────────────────────────────

  if (state.kind === 'mock') {
    const { product } = state;
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <Text style={{ fontSize: s(64) }}>{product.emoji}</Text>
          <Text style={{ fontSize: s(18), fontWeight: '700', color: '#101418' }}>{product.name}</Text>
          <Text style={{ color: '#6F747C' }}>{product.brand}</Text>
        </View>
      </View>
    );
  }

  // ─── Main product view ────────────────────────────────────────────────────

  const {
    off, analysis, analysisFailureReason, aiSummary,
    category: detectedCategory, skincareAnalysis, userId,
  } = state;

  const isAI = off.catalogSource === 'ai_gemini' || off.catalogSource === 'ai_gpt';
  const banned = analysis?.bannedSubstances ?? [];
  const globalBans = analysis?.globalBans ?? { bannedIngredients: [], hasSevereBan: false };
  const dataMismatch = off.dataConfidence === 'low';
  const hallucinationDetected = analysis?._hallucinationDetected === true;

  const verdict: OverallVerdict = analysis
    ? deriveOverallVerdict(analysis.safety, analysis.additives, banned, globalBans, effectiveNova, off.nutriscoreGrade)
    : (() => {
        if (effectiveNova === 1) return 'green' as const;
        const ns = off.nutriscoreGrade?.toLowerCase();
        if (ns === 'e' || ns === 'd') return 'yellow' as const;
        return 'green' as const;
      })();

  const isSkincare = detectedCategory === 'skincare';
  const hasIngredients = !!off.ingredientsText?.trim();

  return (
    <View style={styles.root}>
      {header}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + s(32) }}
      >
        {/* 1. Verdict Hero */}
        <VerdictHero
          off={off}
          verdict={verdict}
          analysis={analysis}
          effectiveNova={effectiveNova}
          detectedCategory={detectedCategory}
          isAI={isAI}
          dataMismatch={dataMismatch}
          hallucinationDetected={hallucinationDetected}
          onNSPress={() => setInfoModal('nutriscore')}
          onNOVAPress={() => setInfoModal('nova')}
        />

        {/* Skincare: show SkinSafetyTab inline */}
        {isSkincare && skincareAnalysis && (
          <SkinSafetyTab
            analysis={skincareAnalysis}
            skinType={state.prefs?.skin_type}
            skinConcerns={state.prefs?.skin_concerns}
            productName={off.productName}
          />
        )}

        {/* For non-skincare products: full analysis layout */}
        {!isSkincare && (
          <>
            {/* 2. For You */}
            <ForYouSection analysis={analysis} userId={userId} />

            {/* 3. Quick Stats Strip */}
            {analysis && (
              <QuickStatsStrip
                analysis={analysis}
                off={off}
                effectiveNova={effectiveNova}
                onScrollToConcerns={() => scrollRef.current?.scrollTo({ y: concernsY.current, animated: true })}
                onScrollToBans={() => scrollRef.current?.scrollTo({ y: bansY.current, animated: true })}
                onScrollToNutrition={() => scrollRef.current?.scrollTo({ y: nutritionY.current, animated: true })}
              />
            )}

            {/* 4. Missing Data Card */}
            {(!hasIngredients || analysisFailureReason === 'unavailable') && (
              <MissingDataCard
                off={off}
                barcode={barcode ?? ''}
                analysisFailureReason={analysisFailureReason}
                onRetry={load}
                navigation={navigation}
              />
            )}

            {/* 5. Ingredient Concern Cards */}
            <View
              onLayout={(e) => { concernsY.current = e.nativeEvent.layout.y; }}
            >
              <ConcernCards
                additives={analysis?.additives ?? null}
                onSelect={setAdditiveModal}
              />
            </View>

            {/* 6. Full Ingredient List */}
            <FullIngredientList
              off={off}
              analysis={analysis}
              userAllergens={userAllergens}
            />

            {/* 7. International Bans */}
            <View
              onLayout={(e) => { bansY.current = e.nativeEvent.layout.y; }}
            >
              <InternationalBansSection
                analysis={analysis}
                onBannedSelect={setBannedModal}
              />
            </View>

            {/* 8. Nutrition */}
            <View
              onLayout={(e) => { nutritionY.current = e.nativeEvent.layout.y; }}
            >
              <NutritionSection
                off={off}
                effectiveNova={effectiveNova}
                onNSPress={() => setInfoModal('nutriscore')}
                onNOVAPress={() => setInfoModal('nova')}
              />
            </View>

            {/* 9. AI Insight */}
            <AIInsightSection aiSummary={aiSummary} />
          </>
        )}

        {/* Footer actions */}
        <View style={[styles.footerRow, { marginTop: s(16) }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingVertical: s(8) }}
          >
            <Ionicons name="scan-outline" size={s(15)} color="#C0C0BC" />
            <Text style={styles.footerText}>Scan another product</Text>
          </Pressable>
          <Pressable
            onPress={() => setFeedbackOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingVertical: s(8) }}
          >
            <Text style={styles.footerText}>Report issue</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modals */}
      <InfoModal type={infoModal} novaGroup={effectiveNova} nutriscoreGrade={off.nutriscoreGrade} onClose={() => setInfoModal(null)} />
      <AdditiveDetailModal item={additiveModal} onClose={() => setAdditiveModal(null)} />
      <BannedSubstanceModal item={bannedModal} onClose={() => setBannedModal(null)} />
      <FeedbackModal visible={feedbackOpen} barcode={off.code} userId={userId} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}

// ─── Modal styles ─────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#FAFAF7', borderRadius: s(28), borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', padding: s(20), paddingBottom: s(8), maxHeight: '82%' },
  handle:       { width: s(36), height: s(4), backgroundColor: '#D0D0CC', borderRadius: s(2), alignSelf: 'center', marginBottom: s(18) },
  badge:        { flexDirection: 'row', alignItems: 'center', gap: s(6), alignSelf: 'flex-start', paddingHorizontal: s(12), paddingVertical: s(5), borderRadius: s(8), marginBottom: s(14) },
  badgeDot:     { width: s(8), height: s(8), borderRadius: s(4) },
  badgeText:    { fontSize: s(12), fontWeight: '700' },
  title:        { fontSize: s(18), fontWeight: '800', color: '#101418', marginBottom: s(4) },
  divider:      { height: 1, backgroundColor: '#F4F4F0', marginBottom: s(14) },
  section:      { marginBottom: s(16) },
  sectionLabel: { fontSize: s(10), fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#8C9299', marginBottom: s(8) },
  body:         { fontSize: s(13), color: '#6F747C', lineHeight: s(21) },
  contextBox:   { backgroundColor: '#F4F4F0', borderRadius: s(12), padding: s(12), borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  sourceRow:    { flexDirection: 'row', alignItems: 'center', gap: s(6), padding: s(10), backgroundColor: '#F4F4F0', borderRadius: s(10), marginVertical: s(8), borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  sourceText:   { fontSize: s(12), color: '#1B5E52', flex: 1 },
  doneBtn:      { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: s(12), padding: s(13), alignItems: 'center', marginTop: s(8), marginBottom: s(4) },
  doneBtnText:  { fontSize: s(15), fontWeight: '700', color: '#101418' },
  novaRow:      { flexDirection: 'row', gap: s(12), paddingVertical: s(10), paddingHorizontal: s(4), marginBottom: s(4) },
  novaNum:      { width: s(28), height: s(28), borderRadius: s(6), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  novaNumText:  { color: '#FFF', fontWeight: '800', fontSize: s(13) },
  novaTitle:    { fontSize: s(13), fontWeight: '700', color: '#101418', marginBottom: s(2) },
  novaDesc:     { fontSize: s(12), color: '#6F747C', lineHeight: s(18) },
  nsGrade:      { width: s(28), height: s(28), borderRadius: s(6), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nsGradeText:  { color: '#FFF', fontWeight: '900', fontSize: s(14) },
});

// ─── Screen styles (v4 design) ────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#FAFAF7' },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(24) },

  // Header — v4: handle bar + title + close circle
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingBottom: s(12),
    backgroundColor: '#FAFAF7',
  },
  headerTitle:  { fontSize: s(17), fontWeight: '700', color: '#101418' },
  backBtn: {
    width: s(36),
    height: s(36),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  // Product header card — white card like v4 design
  productHeaderCard: {
    backgroundColor: 'white',
    marginHorizontal: s(14),
    marginTop: s(12),
    marginBottom: s(8),
    borderRadius: s(20),
    padding: s(14),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    gap: s(14),
    alignItems: 'flex-start',
  },
  flaggedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: s(100),
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    marginTop: s(8),
    borderWidth: 1,
  },
  flaggedPillText: { fontSize: s(12), fontWeight: '600' },

  // Verdict Hero — v4: warm-tinted card, no left border
  verdictHero: {
    marginHorizontal: s(14),
    marginBottom: s(8),
    borderRadius: s(20),
    padding: s(16),
    borderWidth: 1,
  },
  verdictLabel: { fontSize: s(10), fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: s(8) },
  verdictRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: s(12) },
  verdictLine1: { fontSize: s(30), fontWeight: '800', color: '#101418', lineHeight: s(34) },
  verdictLine2: { fontSize: s(30), fontWeight: '800', lineHeight: s(36) },
  scoreRing: {
    width: s(68), height: s(68), borderRadius: s(34),
    borderWidth: s(3), alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  scoreRingInner: {
    position: 'absolute', width: s(56), height: s(56), borderRadius: s(28),
    borderWidth: s(4),
  },
  scoreRingEmoji: { fontSize: s(22), lineHeight: s(28) },
  verdictQuickStats: { flexDirection: 'row', gap: s(8) },
  verdictStatChip: { flex: 1, borderRadius: s(12), paddingVertical: s(10), paddingHorizontal: s(6), alignItems: 'center' },
  verdictStatValue: { fontSize: s(12), fontWeight: '700', color: '#101418', textAlign: 'center' },
  verdictStatLabel: { fontSize: s(10), color: '#8C9299', marginTop: s(2), textAlign: 'center', lineHeight: s(13) },

  heroIdentityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(12), marginBottom: s(10) },
  heroImage:    { width: s(68), height: s(68), borderRadius: s(16), backgroundColor: '#F4F4F0' },
  heroImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroBrand:    { fontSize: s(11), fontWeight: '700', color: '#8C9299', letterSpacing: 1, textTransform: 'uppercase', marginBottom: s(2) },
  heroName:     { fontSize: s(20), fontWeight: '800', color: '#101418', lineHeight: s(26) },
  heroBarcode:  { fontSize: s(12), color: '#8C9299', marginTop: s(4) },
  verdictPill:  { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: s(100), alignSelf: 'flex-start', marginTop: s(4) },
  verdictPillText: { fontSize: s(13), fontWeight: '700', letterSpacing: 0.2 },
  verdictDecision: { fontSize: s(12), color: '#6F747C', lineHeight: s(18), marginTop: s(8) },
  herosBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(6) },
  scoreBadge:   { paddingHorizontal: s(10), paddingVertical: s(4), borderRadius: s(8) },
  scoreBadgeText: { color: '#FFF', fontSize: s(11), fontWeight: '700' },
  aiBadge:      { backgroundColor: '#F4F4F0', paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: s(8), alignSelf: 'flex-start' },
  aiBadgeText:  { fontSize: s(10), color: '#8C9299', fontWeight: '600' },
  heroNotice:   { fontSize: s(11), color: '#8C9299', lineHeight: s(16), marginTop: s(8), fontStyle: 'italic' },

  // Stats Strip
  statsStrip:   { flexDirection: 'row', flexWrap: 'wrap', gap: s(8), paddingHorizontal: s(14), paddingVertical: s(6) },
  statChip:     { paddingHorizontal: s(14), paddingVertical: s(7), borderRadius: s(100), borderWidth: 1, backgroundColor: 'white' },
  statChipText: { fontSize: s(12), fontWeight: '600', color: '#101418' },

  // For You
  forYouRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: s(8), padding: s(10), borderLeftWidth: 3, borderRadius: s(10), marginBottom: s(6) },
  forYouIcon:   { fontSize: s(14), lineHeight: s(20) },
  forYouText:   { flex: 1, fontSize: s(13), color: '#6F747C', lineHeight: s(20) },

  // Missing data
  missingCard:  { marginHorizontal: s(14), marginVertical: s(8), backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: 'rgba(201,130,0,0.2)', borderRadius: s(20), padding: s(16) },
  missingCardTitle: { fontSize: s(15), fontWeight: '700', color: '#C98200', marginBottom: s(6) },
  missingCardBody:  { fontSize: s(13), color: '#6F747C', lineHeight: s(20), marginBottom: s(12) },
  missingCardBtn:   { backgroundColor: '#1B5E52', borderRadius: s(100), height: s(50), paddingHorizontal: s(20), alignItems: 'center', justifyContent: 'center', marginHorizontal: s(14), marginVertical: s(6) },
  missingCardBtnText: { fontSize: s(14), fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },

  // Sections
  sectionBlock: { marginTop: s(16) },
  sectionTitle: { fontSize: s(16), fontWeight: '700', color: '#101418', marginHorizontal: s(14), marginBottom: s(10) },

  // Card — v4: white, radius 20, cream border
  card:         { backgroundColor: 'white', marginHorizontal: s(14), borderRadius: s(20), padding: s(14), borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  cardLabel:    { fontSize: s(10), fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#8C9299', marginBottom: s(10) },
  cardBlue:     { backgroundColor: '#EAF7EF', borderColor: 'rgba(24,138,85,0.15)' },
  cardRed:      { backgroundColor: '#FFEDEE', borderColor: 'rgba(229,57,70,0.12)' },

  // Concern cards
  concernCard:  { borderLeftWidth: 4, borderRadius: s(16), padding: s(14), marginHorizontal: s(14), marginBottom: s(8), flexDirection: 'row', alignItems: 'flex-start', gap: s(10) },
  concernIngredient: { fontSize: s(14), fontWeight: '700', color: '#101418', marginBottom: s(3) },
  concernReason:    { fontSize: s(12), color: '#6F747C', lineHeight: s(18) },
  sevPill:      { paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(8), borderWidth: 1 },
  sevPillText:  { fontSize: s(10), fontWeight: '700' },

  // Ingredient list
  ingRow:       { flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(10) },
  ingDot:       { width: s(8), height: s(8), borderRadius: s(4), flexShrink: 0 },
  ingName:      { flex: 1, fontSize: s(13), color: '#101418', lineHeight: s(20) },
  allergenBadge: { backgroundColor: '#FFEDEE', paddingHorizontal: s(7), paddingVertical: s(3), borderRadius: s(8) },
  allergenBadgeText: { fontSize: s(10), fontWeight: '800', color: '#E53946' },
  sevPillSmall: { paddingHorizontal: s(6), paddingVertical: s(2), borderRadius: s(6) },
  sevPillSmallText: { fontSize: s(10), fontWeight: '700' },

  // Bans
  banRow:       { flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(12) },
  banRowBorder: { borderTopWidth: 1, borderTopColor: '#F4F4F0' },
  banName:      { fontSize: s(13), fontWeight: '700', color: '#101418', marginBottom: s(2) },
  banSub:       { fontSize: s(11), color: '#8C9299', lineHeight: s(16) },
  banBadge:     { backgroundColor: '#FFEDEE', paddingHorizontal: s(7), paddingVertical: s(3), borderRadius: s(8) },
  banBadgeText: { fontSize: s(10), fontWeight: '800', color: '#E53946' },
  rowArrow:     { fontSize: s(18), color: '#D0D0CC' },
  sourceLink:   { fontSize: s(11), color: '#1B5E52', flexShrink: 0 },

  // Nutrition
  nutriBadgeRow: { flexDirection: 'row', gap: s(10), marginHorizontal: s(14), marginBottom: s(10) },
  nutriMetric:  { flex: 1, backgroundColor: 'white', borderRadius: s(16), padding: s(14), borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', flexDirection: 'row', alignItems: 'center', gap: s(10) },
  nutriMetricVal: { fontSize: s(24), fontWeight: '900', color: '#101418' },
  nutriMetricLabel: { flex: 1, fontSize: s(11), color: '#8C9299', lineHeight: s(16) },
  nutriRow:     { flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(12) },
  nutriLabel:   { fontSize: s(11), color: '#8C9299', fontWeight: '600', marginBottom: s(2) },
  nutriValue:   { fontSize: s(15), fontWeight: '800', color: '#101418' },
  nutriWhat:    { fontSize: s(12), color: '#8C9299', lineHeight: s(18) },
  alertDot:     { width: s(8), height: s(8), borderRadius: s(4), flexShrink: 0 },

  // Footer
  footerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: s(20), paddingBottom: s(8), marginTop: s(8) },
  footerText:   { fontSize: s(12), color: '#C0C0BC' },

  // Feedback input
  feedbackInput: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderRadius: s(12), padding: s(12), fontSize: s(13), color: '#101418', backgroundColor: 'white', minHeight: s(100), textAlignVertical: 'top', marginBottom: s(4) },

  // Retry
  retryBtn:     { marginTop: s(16), paddingHorizontal: s(24), paddingVertical: s(12), backgroundColor: '#F4F4F0', borderRadius: s(14) },
});
