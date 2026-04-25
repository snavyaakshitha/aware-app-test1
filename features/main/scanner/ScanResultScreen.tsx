/**
 * ScanResultScreen — complete rebuild.
 *
 * Three-tab layout:
 *   Tab 1 "Our Take"    — verdict, personalised flags, Aware's editorial, additives, banned substances
 *   Tab 2 "Nutrition"   — Nutri-Score, NOVA, full per-100g table with "What This Means" column
 *   Tab 3 "Ingredients" — colour-coded chips (allergen / concern / ok), tappable for detail
 *
 * All content is driven by:
 *   off.nutriments    — OFF per-100g data (sugars_100g, proteins_100g, fat_100g, etc.)
 *   analysis.safety   — compute_health_fit_score RPC
 *   analysis.additives — get_additive_matches RPC
 *   analysis.bannedSubstances — check_banned_substances RPC
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
import type { SkinCareAnalysisResult, ProductDetectionCategory } from '../../../shared/types';
import SkinSafetyTab from './tabs/SkinSafetyTab';
import {
  fmtNum, inferNovaGroup, deriveOverallVerdict,
  buildNutrientRows, generateHeadline, generateAwareTake,
  type OverallVerdict, type NutrientRow,
} from '../../../shared/awaretake';
import type { ScannerStackParamList, UserPreferences } from '../../../shared/types';
import type { OnboardingData } from '../../../shared/onboardingTypes';

type Props = NativeStackScreenProps<ScannerStackParamList, 'ScanResult'>;

// ─── Load state ───────────────────────────────────────────────────────────────

type AnalysisFailureReason = 'no_user' | 'unavailable' | null;

type LoadState =
  | { kind: 'loading' }
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
    };

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'take' | 'nutrition' | 'ingredients' | 'skin-safety';

// ─── URL safety helper ────────────────────────────────────────────────────────
// Database-sourced URLs are validated before opening to prevent non-https schemes.

function openSafeUrl(url: string | null | undefined): void {
  if (!url) return;
  if (!url.startsWith('https://') && !url.startsWith('http://')) return;
  Linking.openURL(url);
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<OverallVerdict, string> = {
  avoid: 'Avoid', check: 'Check below', acceptable: 'No concerns', good: 'Good',
};
const VERDICT_COLOR: Record<OverallVerdict, string> = {
  avoid: '#ff4d4d', check: '#ffb830', acceptable: '#4caf50', good: '#2ed573',
};
const VERDICT_BG: Record<OverallVerdict, string> = {
  avoid: '#3d0a0a', check: '#2e2000', acceptable: '#0d1f0d', good: '#0a1f12',
};
const VERDICT_BORDER: Record<OverallVerdict, string> = {
  avoid: '#6b1a1a', check: '#5a3d00', acceptable: '#1e4d1e', good: '#1a5c30',
};

// fmtNum, inferNovaGroup, deriveOverallVerdict, buildNutrientRows,
// generateHeadline, and generateAwareTake are imported from shared/awaretake.ts

// ─── Allergen keyword map (for ingredient chip colouring) ────────────────────

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
  severe: '#ff2d55', high: '#ff6b35', medium: '#ffb830', low: '#8e8e93',
};
const SEV_BG: Record<string, string> = {
  severe: '#3d0a14', high: '#2e1500', medium: '#2e2000', low: '#222',
};
const SEV_CONTEXT: Record<string, string> = {
  severe: 'Strong evidence of harm. Avoiding is recommended regardless of quantity.',
  high: 'Significant concerns backed by multiple studies. Worth limiting in your regular diet.',
  medium: 'Evidence is emerging or mixed. Safe at typical doses for most people.',
  low: 'Low concern at typical dietary exposure. Listed for transparency.',
};

// NutrientRow type and buildNutrientRows are imported from shared/awaretake.ts

const ALERT_COLOR = { red: '#EF4444', amber: '#F59E0B', green: '#22C55E', none: '#555' };
const ALERT_BG    = { red: '#2a0a0a', amber: '#2a1a00', green: '#0a1f0a', none: 'transparent' };

// ─── NOVA / Nutri-Score data ─────────────────────────────────────────────────

const NOVA_DATA: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: 'NOVA 1', color: '#2ed573', desc: 'Unprocessed or minimally processed' },
  2: { label: 'NOVA 2', color: '#ffa502', desc: 'Processed culinary ingredients' },
  3: { label: 'NOVA 3', color: '#ff6b35', desc: 'Processed foods' },
  4: { label: 'NOVA 4', color: '#e63312', desc: 'Ultra-processed foods' },
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
              <View style={[ms.badge, { backgroundColor: SEV_BG[sev] }]}>
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
                    <Text style={{ color: '#444' }}>›</Text>
                  </Pressable>
                ) : (
                  <Text style={[ms.body, { color: '#555', fontStyle: 'italic' }]}>
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
              <View style={[ms.badge, { backgroundColor: '#0a1f12', borderWidth: 1, borderColor: '#1a5c30' }]}>
                <Text style={[ms.badgeText, { color: '#2ed573' }]}>✦ BENEFICIAL</Text>
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
              <View style={[ms.badge, { backgroundColor: '#3d0a14', borderWidth: 1, borderColor: '#6b1a1a' }]}>
                <View style={[ms.badgeDot, { backgroundColor: '#ff2d55' }]} />
                <Text style={[ms.badgeText, { color: '#ff2d55' }]}>
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
                <Text style={[ms.body, { color: '#ff6b6b', fontWeight: '600' }]}>
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
                <Text style={ms.sectionLabel}>STATUS IN THE US</Text>
                <Text style={[ms.body, { fontSize: s(12) }]}>
                  This substance remains permitted by the FDA in the United States. Regulatory standards differ across jurisdictions.
                </Text>
              </View>
              {!!item.sourceUrl && (
                <View style={ms.section}>
                  <Text style={ms.sectionLabel}>SOURCE</Text>
                  <Pressable style={ms.sourceRow} onPress={() => openSafeUrl(item.sourceUrl)}>
                    <Text>🔗</Text>
                    <Text style={ms.sourceText} numberOfLines={1}>{item.sourceUrl}</Text>
                    <Text style={{ color: '#444' }}>›</Text>
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
              backgroundColor: isAllergen ? '#3d0a0a' : isConcern ? '#2e1500' : '#0d1f0d',
              borderWidth: 1,
              borderColor: isAllergen ? '#6b1a1a' : isConcern ? '#4a2500' : '#1a4a1a',
            }]}>
              <Text style={[ms.badgeText, {
                color: isAllergen ? '#ff4d4d' : isConcern ? '#ff6b35' : '#2ed573',
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
    const colors: Record<number, string> = { 1: '#2ED573', 2: '#FFA502', 3: '#FF6B35', 4: '#EF4444' };
    return (
      <>
        <Text style={ms.title}>NOVA Processing Groups</Text>
        <Text style={[ms.body, { color: '#666', marginBottom: s(16) }]}>
          Developed at the University of São Paulo. Classifies by industrial processing extent — not nutrient content.
        </Text>
        {([1, 2, 3, 4] as const).map((n) => (
          <View key={n} style={[ms.novaRow, n === novaGroup && { borderColor: '#444', backgroundColor: '#222' }]}>
            <View style={[ms.novaNum, { backgroundColor: colors[n] }]}>
              <Text style={ms.novaNumText}>{n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ms.body, { fontWeight: '700', color: '#fff', marginBottom: 2 }]}>{NOVA_EXPLAIN[n].title}</Text>
              <Text style={[ms.body, { fontSize: s(11) }]}>{NOVA_EXPLAIN[n].desc}</Text>
              {n === novaGroup && <Text style={[ms.body, { fontSize: s(11), color: '#555', fontStyle: 'italic' }]}>e.g. {NOVA_EXPLAIN[n].examples}</Text>}
            </View>
          </View>
        ))}
        <Pressable style={ms.sourceRow} onPress={() => openSafeUrl('https://pubmed.ncbi.nlm.nih.gov/27296553/')}>
          <Feather name="external-link" size={12} color="#3A7BD5" />
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
        <Text style={[ms.body, { color: '#666', marginBottom: s(16) }]}>
          French public health label. Grades A–E based on positive (fibre, protein) vs negative (calories, sat-fat, sugar, salt) nutrients per 100g.
        </Text>
        <View style={{ flexDirection: 'row', gap: s(4), marginBottom: s(14) }}>
          {(['a', 'b', 'c', 'd', 'e'] as const).map((g) => (
            <View key={g} style={[{ flex: 1, borderRadius: s(8), padding: s(8), alignItems: 'center', borderWidth: 1, borderColor: g === grade ? '#555' : '#222', backgroundColor: '#222' }]}>
              <Text style={{ fontWeight: '800', fontSize: s(18), color: gradeColors[g] }}>{g.toUpperCase()}</Text>
              <Text style={{ fontSize: s(9), color: '#555', textAlign: 'center' }}>{NS_EXPLAIN[g]?.desc}</Text>
            </View>
          ))}
        </View>
        <View style={[ms.contextBox, ms.section]}>
          <Text style={ms.sectionLabel}>THIS PRODUCT — {grade.toUpperCase()}</Text>
          <Text style={ms.body}>{NS_EXPLAIN[grade]?.detail}</Text>
        </View>
        <Pressable style={ms.sourceRow} onPress={() => openSafeUrl('https://www.santepubliquefrance.fr/en/nutri-score')}>
          <Feather name="external-link" size={12} color="#3A7BD5" />
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
                <Text style={{ fontWeight: '700', fontSize: s(20), color: '#2ed573' }}>Thank you</Text>
                <Text style={{ fontSize: s(13), color: '#888', textAlign: 'center', lineHeight: s(20), paddingHorizontal: s(8) }}>
                  We received your report. We'll review it and update if needed.
                </Text>
                {submittedAt && (
                  <Text style={{ fontSize: s(11), color: '#555', marginTop: s(4) }}>
                    Submitted {submittedAt.toLocaleTimeString()}
                  </Text>
                )}
              </View>
            ) : (
              <>
                <Text style={ms.title}>Something wrong?</Text>
                <Text style={[ms.body, { color: '#666', marginBottom: s(12) }]}>
                  Tell us what's incorrect — wrong verdict, missing ingredient, misidentified allergen.
                </Text>
                {submitError && (
                  <View style={{ backgroundColor: '#2a0a0a', borderRadius: s(8), padding: s(10), marginBottom: s(10) }}>
                    <Text style={{ color: '#ff4d4d', fontSize: s(13) }}>
                      Couldn't send your report. Check your connection and try again.
                    </Text>
                  </View>
                )}
                <TextInput
                  style={[styles.feedbackInput, text.length > MAX && { borderColor: '#ff4d4d' }]}
                  placeholder="Describe the issue... (max 500 characters)"
                  placeholderTextColor="#555"
                  multiline numberOfLines={4}
                  value={text}
                  onChangeText={(t) => t.length <= MAX && setText(t)}
                  maxLength={MAX}
                  editable={!submitting}
                />
                <View style={{ alignItems: 'flex-end', marginBottom: s(8) }}>
                  <Text style={{ fontSize: s(11), color: text.length > MAX * 0.9 ? '#ff9500' : '#666' }}>
                    {text.length}/{MAX}
                  </Text>
                </View>
              </>
            )}
            <Pressable
              style={[ms.doneBtn, done && { backgroundColor: '#1a3a1a' }, (!canSubmit && !done) && { opacity: 0.5 }]}
              onPress={done ? handleClose : submit}
              disabled={!canSubmit && !done}
            >
              <Text style={ms.doneBtnText}>
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
  onAdditiveSelect, onBannedSelect, onBeneficialSelect,
  onFeedback,
}: {
  off: OffProductSnapshot;
  analysis: ProductAnalysisResult | null;
  analysisFailureReason: AnalysisFailureReason;
  aiSummary: string | null;
  conditions: string[];
  effectiveNova: number | null;
  onAdditiveSelect: (item: AdditiveItem) => void;
  onBannedSelect: (item: BannedSubstanceMatch) => void;
  onBeneficialSelect: (item: BeneficialItem) => void;
  onFeedback: () => void;
}) {
  const safety = analysis?.safety;
  const additives = analysis?.additives;
  const banned = analysis?.bannedSubstances ?? [];

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>

      {/* NOVA 1 editorial card (shown when analysis ran but product is a whole food) */}
      {analysis === null && effectiveNova === 1 && (
        <View style={[styles.card, { borderColor: '#1a5c30', backgroundColor: '#0a1f12' }]}>
          <Text style={[styles.cardLabel, { color: '#2ed573' }]}>🌿 WHOLE FOOD</Text>
          <Text style={{ color: '#ccc', fontSize: s(13), lineHeight: s(20) }}>
            This appears to be an unprocessed or minimally processed food (NOVA 1). No industrial
            additives, no ultra-processing — as close to nature as food gets. Nutri-Score and
            NOVA classification weren't available from the database, but single-ingredient whole
            foods don't need a score.
          </Text>
        </View>
      )}

      {/* Auth CTA — only shown when user is not signed in (analysis didn't run, not an error) */}
      {analysisFailureReason === 'no_user' && (
        <View style={[styles.card, { borderColor: '#5a3d00', backgroundColor: '#2e2000' }]}>
          <Text style={[styles.cardLabel, { color: '#ffb830' }]}>🔒 SIGN IN FOR FULL ANALYSIS</Text>
          <Text style={{ color: '#ccc', fontSize: s(13), lineHeight: s(20), marginBottom: s(10) }}>
            The safety check above is generic. Sign in to get a personalised analysis based on your
            health conditions and allergens.
          </Text>
          <Text style={{ color: '#888', fontSize: s(11) }}>
            Tap Profile → Sign in. The analysis will update automatically.
          </Text>
        </View>
      )}

      {/* Retry CTA — shown when analysis failed due to a service error */}
      {analysisFailureReason === 'unavailable' && (
        <View style={[styles.card, { borderColor: '#333', backgroundColor: '#1a1a1a' }]}>
          <Text style={[styles.cardLabel, { color: '#888' }]}>⚠ ANALYSIS UNAVAILABLE</Text>
          <Text style={{ color: '#888', fontSize: s(13), lineHeight: s(20) }}>
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

      {/* Banned substances */}
      {banned.length > 0 && (
        <View style={[styles.card, styles.cardRed]}>
          <Text style={styles.cardLabel}>🚫 BANNED SUBSTANCES ({banned.length}) — TAP FOR DETAILS</Text>
          {banned.map((item, i) => (
            <Pressable
              key={i}
              style={[styles.row, i < banned.length - 1 && styles.rowBorder]}
              onPress={() => onBannedSelect(item)}
            >
              <View style={[styles.dot, { backgroundColor: '#ff2d55' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.substanceName}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  Banned in: {item.jurisdictions.slice(0, 3).join(', ')}{item.jurisdictions.length > 3 ? ` +${item.jurisdictions.length - 3}` : ''}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: '#3d0a14' }]}>
                <Text style={[styles.badgeText, { color: '#ff2d55' }]}>BANNED</Text>
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
              <Text style={{ fontSize: s(15), color: '#2ed573', flexShrink: 0 }}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: '#2ed573' }]}>{item.ingredient}</Text>
                {!!item.reason && <Text style={styles.rowSub} numberOfLines={2}>{item.reason}</Text>}
              </View>
              <Text style={[styles.rowArrow, { color: '#2ed573' }]}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* AI quick insight (secondary, optional) */}
      {!!aiSummary && (
        <View style={[styles.awareTakeCard, { opacity: 0.7 }]}>
          <Text style={[styles.awareTakeLabel, { color: '#555' }]}>🤖 AI quick insight</Text>
          <Text style={[styles.awareTakeText, { color: '#777', fontSize: s(12) }]}>{aiSummary}</Text>
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
          <Text style={{ fontSize: s(18), color: '#2ed573' }}>✓</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: '#2ed573' }]}>No conflicts found</Text>
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
            <Text style={[styles.rowTitle, { color: '#ff4d4d' }]}>Allergen detected</Text>
            <Text style={styles.rowSub}>
              Contains:{' '}
              {safety.allergenConflicts.map((a, i) => (
                <Text key={i} style={{ color: '#ff6b6b', fontWeight: '600' }}>{a}</Text>
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
          <Text style={{ fontSize: s(11), color: '#555' }}>
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
        <Text style={{ fontSize: s(13), color: '#555', lineHeight: s(19) }}>
          Ingredient analysis unavailable — connect to check this product against our database.
        </Text>
      </View>
    );
  }
  if (!additives || additives.total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>✓ ADDITIVES</Text>
        <Text style={{ fontSize: s(13), color: '#555' }}>No concerning additives detected.</Text>
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
            <View style={[styles.badge, { backgroundColor: SEV_BG[item.severity ?? 'low'] }]}>
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
  const nutrientRows = useMemo(
    () => nm ? buildNutrientRows(nm, effectiveNova) : [],
    [nm, effectiveNova],
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
                        <Text style={[styles.nsBlockText, g === 'c' && { color: '#111' }]}>{g.toUpperCase()}</Text>
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
                    <Text style={[styles.novaBlockText, n === 1 && { color: '#111' }]}>{n}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.metricNote} numberOfLines={2}>{NOVA_DATA[effectiveNova]?.desc}</Text>
              {nova === null && <Text style={[styles.metricTapHint, { color: '#444', fontStyle: 'italic' }]}>Inferred from product structure</Text>}
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
                <Text style={[styles.nutriValue, { color: row.alert !== 'none' ? ALERT_COLOR[row.alert] : '#fff' }]}>
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
          <Text style={{ fontSize: s(13), color: '#555', lineHeight: s(20) }}>
            Detailed nutrition data is not available for this product. This can happen for products not in the Open Food Facts database.
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
        {allergenCount > 0 && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ff4d4d' }]} /><Text style={styles.legendText}>{allergenCount} allergen{allergenCount !== 1 ? 's' : ''}</Text></View>}
        {concernCount > 0 && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ff6b35' }]} /><Text style={styles.legendText}>{concernCount} concern{concernCount !== 1 ? 's' : ''}</Text></View>}
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#444' }]} /><Text style={styles.legendText}>ok</Text></View>
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
                chip.flag === 'allergen' && { color: '#ff4d4d' },
                chip.flag === 'concern' && { color: '#ff6b35' },
              ]} numberOfLines={2}>{chip.name}</Text>
              {chip.flag !== 'ok' && <Text style={styles.chipArrow}>›</Text>}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={{ fontSize: s(13), color: effectiveNova === 1 ? '#aaa' : '#555', lineHeight: s(20) }}>
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
        // If no explicit route category, use whatever the snapshot knows
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
      if (!snapshot) {
        setState({ kind: 'error', message: 'Product not found. Try scanning again or use AI analysis.' });
        return;
      }

      const conditions = ((prefs?.healthConditions as string[] | undefined) ?? []);

      let analysis: ProductAnalysisResult | null = null;
      let analysisFailureReason: AnalysisFailureReason = null;
      let skincareAnalysis: SkinCareAnalysisResult | null = null;

      if (isSkincare) {
        // Skincare path: call compute_skincare_score
        skincareAnalysis = await fetchSkinCareAnalysis(snapshot.ingredientsText, userId).catch(() => null);
      } else {
        // Food path: existing analysis chain
        if (!userId) {
          analysisFailureReason = 'no_user';
        } else {
          try {
            analysis = await fetchProductAnalysis(barcode, userId, snapshot.ingredientsText);
            if (analysis === null) analysisFailureReason = 'unavailable';
          } catch {
            analysisFailureReason = 'unavailable';
          }
        }
      }

      const aiSummary = isSkincare ? null : await fetchAISummary(
        barcode, userId, snapshot.productName, snapshot.ingredientsText, conditions,
      ).catch(() => null);

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
      });

      // Analytics: record scan event (non-blocking)
      if (supabase) {
        const scanVerdict = analysis
          ? (analysis.safety.allergenConflicts.length > 0 || analysis.bannedSubstances.length > 0 ? 'avoid'
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

  // When category is resolved from snapshot (not from route param), sync the initial tab
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
        <Ionicons name="chevron-back" size={s(24)} color="#fff" />
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
          <ActivityIndicator size="large" color="#8bc53d" />
          <Text style={{ fontSize: s(15), color: '#888', marginTop: s(12) }}>Analysing product…</Text>
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
          <Text style={{ fontSize: s(18), fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: s(12) }}>{state.message}</Text>
          {isNotFound && barcode && (
            <Pressable
              onPress={() => navigation.replace('AIFallback', { barcode })}
              style={[styles.retryBtn, { backgroundColor: '#1a3a1a', borderWidth: 1, borderColor: '#2a5a2a' }]}
            >
              <Text style={{ fontSize: s(15), color: '#8bc53d', fontWeight: '600' }}>Try AI analysis →</Text>
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
          <Text style={{ fontSize: s(18), fontWeight: '700', color: '#fff' }}>{product.name}</Text>
          <Text style={{ color: '#888' }}>{product.brand}</Text>
          <Text style={{ color: '#555', fontSize: s(11), marginTop: s(12) }}>This is demo/catalog data.</Text>
        </View>
      </View>
    );
  }

  // ── Main OFF product view ────────────────────────────────────────────────────
  const { off, analysis, analysisFailureReason, aiSummary, category: detectedCategory, skincareAnalysis } = state;
  const isAI = off.catalogSource === 'ai_gemini' || off.catalogSource === 'ai_gpt';

  const banned = analysis?.bannedSubstances ?? [];
  const verdict = analysis
    ? deriveOverallVerdict(analysis.safety, analysis.additives, banned, effectiveNova, off.nutriscoreGrade)
    : (() => {
        if (effectiveNova === 1) return 'good' as const;
        const ns = off.nutriscoreGrade?.toLowerCase();
        if (ns === 'e' || ns === 'd') return 'check' as const;
        if (ns === 'a' || ns === 'b') return 'good' as const;
        return 'acceptable' as const;
      })();

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

      {/* Verdict + headline — food only; skincare uses SkinSafetyTab verdict */}
      {detectedCategory !== 'skincare' && (
        <View style={styles.verdictBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: s(8) }}>
            <View
              style={[styles.pill, { backgroundColor: VERDICT_BG[verdict], borderColor: VERDICT_BORDER[verdict], marginBottom: 0 }]}
              accessibilityLabel={`Overall verdict: ${VERDICT_LABEL[verdict]}`}
              accessibilityRole="text"
            >
              <View style={[styles.pillDot, { backgroundColor: VERDICT_COLOR[verdict] }]} />
              <Text style={[styles.pillText, { color: VERDICT_COLOR[verdict] }]}>{VERDICT_LABEL[verdict]}</Text>
            </View>
            {verdict === 'check' && analysis && (
              <Text style={{ fontSize: s(11), color: '#ffb830', flexShrink: 1 }}>
                {(analysis.additives.high.length + analysis.additives.severe.length) > 0
                  ? `${analysis.additives.high.length + analysis.additives.severe.length} ingredient${analysis.additives.high.length + analysis.additives.severe.length !== 1 ? 's' : ''} flagged ↓ tap below`
                  : analysis.safety.cautionList.length > 0
                  ? `${analysis.safety.cautionList.length} caution${analysis.safety.cautionList.length !== 1 ? 's' : ''} for your profile ↓`
                  : 'See details below ↓'}
              </Text>
            )}
          </View>
          <Text style={styles.verdictHeadline}>{headline}</Text>
          {isAI && (
            <Text style={styles.aiDisclaimer}>🤖 AI-extracted — verify allergens on the physical package.</Text>
          )}
          {!analysis && (
            <Text style={{ fontSize: s(11), color: '#555', marginTop: s(4) }}>
              Ingredient analysis unavailable — connect for full safety check.
            </Text>
          )}
        </View>
      )}
      {detectedCategory === 'skincare' && isAI && (
        <View style={{ paddingHorizontal: s(16), paddingBottom: s(8) }}>
          <Text style={styles.aiDisclaimer}>🤖 AI-extracted — verify ingredients on the physical package.</Text>
        </View>
      )}

      {/* Tab bar — exclusive per category */}
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

      {/* Tab content — exclusive per category */}
      <View style={{ flex: 1 }}>
        {/* Skincare-specific tabs */}
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
            <Text style={{ color: '#fff', fontSize: s(16), fontWeight: '700', textAlign: 'center' }}>
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
                style={{ marginTop: s(8), backgroundColor: 'rgba(139,197,61,0.12)', borderWidth: 1, borderColor: 'rgba(139,197,61,0.35)', borderRadius: s(10), paddingHorizontal: s(20), paddingVertical: s(12) }}
              >
                <Text style={{ color: '#8bc53d', fontSize: s(14), fontWeight: '600' }}>
                  Try AI analysis →
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Food-specific tabs */}
        {tab === 'take' && (
          <OurTakeTab
            off={off} analysis={analysis} analysisFailureReason={analysisFailureReason}
            aiSummary={aiSummary} conditions={conditions}
            effectiveNova={effectiveNova}
            onAdditiveSelect={setAdditiveModal}
            onBannedSelect={setBannedModal}
            onBeneficialSelect={setBeneficialModal}
            onFeedback={() => setFeedbackOpen(true)}
          />
        )}
        {tab === 'nutrition' && (
          <NutritionTab off={off} onInfoModal={setInfoModal} />
        )}

        {/* Shared tab */}
        {tab === 'ingredients' && (
          <IngredientsTab off={off} userAllergens={userAllergens} />
        )}
      </View>

      {/* Footer */}
      <Pressable onPress={() => navigation.goBack()} style={[styles.footer, { paddingBottom: insets.bottom + s(12) }]}>
        <Ionicons name="scan-outline" size={s(16)} color="#888" />
        <Text style={styles.footerText}>Scan another product</Text>
      </Pressable>

      {/* All modals */}
      <InfoModal type={infoModal} novaGroup={effectiveNova} nutriscoreGrade={off.nutriscoreGrade} onClose={() => setInfoModal(null)} />
      <AdditiveDetailModal item={additiveModal} onClose={() => setAdditiveModal(null)} />
      <BeneficialDetailModal item={beneficialModal} onClose={() => setBeneficialModal(null)} />
      <BannedSubstanceModal item={bannedModal} onClose={() => setBannedModal(null)} />
      <FeedbackModal visible={feedbackOpen} barcode={off.code} userId={state.userId} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}

// ─── Modal styles (shared) ────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#181818', borderRadius: s(24), borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1, borderColor: '#2a2a2a', padding: s(20), paddingBottom: s(8), maxHeight: '82%' },
  handle:     { width: s(36), height: s(4), backgroundColor: '#333', borderRadius: s(2), alignSelf: 'center', marginBottom: s(18) },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: s(6), alignSelf: 'flex-start', paddingHorizontal: s(12), paddingVertical: s(5), borderRadius: s(8), marginBottom: s(14) },
  badgeDot:   { width: s(8), height: s(8), borderRadius: s(4) },
  badgeText:  { fontSize: s(12), fontWeight: '700' },
  title:      { fontSize: s(18), fontWeight: '800', color: '#fff', marginBottom: s(4) },
  divider:    { height: 1, backgroundColor: '#222', marginBottom: s(14) },
  section:    { marginBottom: s(16) },
  sectionLabel: { fontSize: s(10), fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#555', marginBottom: s(8) },
  body:       { fontSize: s(13), color: '#aaa', lineHeight: s(21) },
  contextBox: { backgroundColor: '#1a1a1a', borderRadius: s(12), padding: s(12), borderWidth: 1, borderColor: '#2a2a2a' },
  sourceRow:  { flexDirection: 'row', alignItems: 'center', gap: s(6), padding: s(10), backgroundColor: '#111', borderRadius: s(10), marginVertical: s(8), borderWidth: 1, borderColor: '#2a2a2a' },
  sourceText: { fontSize: s(12), color: '#3a7bd5', flex: 1 },
  doneBtn:    { backgroundColor: '#222', borderRadius: s(12), padding: s(13), alignItems: 'center', marginTop: s(8), marginBottom: s(4) },
  doneBtnText: { fontSize: s(14), fontWeight: '600', color: '#fff' },
  novaRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: s(10), padding: s(10), borderRadius: s(10), borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a', marginBottom: s(6) },
  novaNum:    { width: s(28), height: s(28), borderRadius: s(6), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  novaNumText: { fontWeight: '800', fontSize: s(13), color: '#111' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#111' },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(12), padding: s(24) },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(20), paddingBottom: s(12), zIndex: 10 },
  backBtn:    { width: s(32), height: s(32), borderRadius: s(16), backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: s(13), color: '#888' },

  hero:       { flexDirection: 'row', gap: s(14), paddingHorizontal: s(16), paddingBottom: s(14), alignItems: 'flex-start' },
  heroThumb:  { width: s(60), height: s(60), borderRadius: s(12), backgroundColor: '#222', flexShrink: 0, overflow: 'hidden' },
  heroThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroBrand:  { fontSize: s(10), color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: s(2) },
  heroName:   { fontSize: s(17), fontWeight: '700', color: '#fff', lineHeight: s(22), marginBottom: s(3) },
  heroBarcode: { fontSize: s(10), color: '#555' },

  verdictBlock: { paddingHorizontal: s(16), paddingBottom: s(12) },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: s(6), alignSelf: 'flex-start', paddingHorizontal: s(12), paddingVertical: s(5), borderRadius: s(100), borderWidth: 1.5, marginBottom: s(8) },
  pillDot:    { width: s(7), height: s(7), borderRadius: s(4) },
  pillText:   { fontSize: s(13), fontWeight: '700' },
  verdictHeadline: { fontSize: s(19), fontWeight: '800', color: '#fff', lineHeight: s(26) },
  aiDisclaimer: { fontSize: s(11), color: '#666', marginTop: s(6) },

  tabBar:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#111' },
  tabItem:    { flex: 1, paddingVertical: s(12), alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: '#8bc53d' },
  tabLabel:   { fontSize: s(13), color: '#555', fontWeight: '500' },
  tabLabelActive: { color: '#8bc53d', fontWeight: '700' },

  tabContent: { paddingHorizontal: s(16), paddingTop: s(14) },

  card:       { backgroundColor: '#1a1a1a', borderRadius: s(16), borderWidth: 1, borderColor: '#2a2a2a', padding: s(14), marginBottom: s(10) },
  cardRed:    { borderColor: '#4a1a1a' },
  cardYellow: { borderColor: '#4a3a00' },
  cardGreen:  { borderColor: '#1a4a1a' },
  cardLabel:  { fontSize: s(10), fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#555', marginBottom: s(10) },

  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: s(8), paddingVertical: s(9) },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: '#222' },
  rowTitle:   { fontSize: s(13), fontWeight: '600', color: '#fff', marginBottom: s(2) },
  rowSub:     { fontSize: s(12), color: '#666', lineHeight: s(17) },
  rowArrow:   { fontSize: s(14), color: '#444', flexShrink: 0, marginTop: s(2) },
  dot:        { width: s(8), height: s(8), borderRadius: s(4), flexShrink: 0, marginTop: s(5) },
  badge:      { borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3), flexShrink: 0 },
  badgeText:  { fontSize: s(10), fontWeight: '700' },

  safetyRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: s(10), marginBottom: s(8) },

  awareTakeCard: { backgroundColor: '#111820', borderRadius: s(16), borderWidth: 1, borderColor: '#1a2a3a', padding: s(14), marginBottom: s(10) },
  awareTakeLabel: { fontSize: s(10), fontWeight: '700', letterSpacing: 1, color: '#3a7bd5', textTransform: 'uppercase', marginBottom: s(8) },
  awareTakeText:  { fontSize: s(13), color: '#aaa', lineHeight: s(21) },

  metricsRow: { flexDirection: 'row', gap: s(10), marginBottom: s(10) },
  metricCard: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: s(16), padding: s(12) },
  metricNote: { fontSize: s(11), color: '#666', lineHeight: s(15), marginTop: s(2) },
  metricTapHint: { fontSize: s(10), color: '#444', marginTop: s(5) },
  metricMuted: { fontSize: s(12), color: '#555', marginTop: s(4), lineHeight: s(17) },

  nsBlock:    { flex: 1, height: s(22), borderRadius: s(4), alignItems: 'center', justifyContent: 'center' },
  nsBlockText: { fontSize: s(10), fontWeight: '800', color: '#fff' },
  novaBlock:  { width: s(28), height: s(28), borderRadius: s(6), alignItems: 'center', justifyContent: 'center' },
  novaBlockText: { fontSize: s(11), fontWeight: '800', color: '#fff' },

  nutriRow:   { flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: s(10), paddingHorizontal: s(6), borderRadius: s(8), marginBottom: s(2) },
  nutriLabel: { fontSize: s(11), color: '#666', marginBottom: s(2) },
  nutriValue: { fontSize: s(15), fontWeight: '700' },
  nutriWhat:  { fontSize: s(12), lineHeight: s(17) },
  alertDot:   { width: s(8), height: s(8), borderRadius: s(4), flexShrink: 0 },

  chipLegend: { flexDirection: 'row', gap: s(12), marginBottom: s(12), flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(5) },
  legendDot:  { width: s(8), height: s(8), borderRadius: s(4) },
  legendText: { fontSize: s(11), color: '#666' },

  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: s(8) },
  chip:       { paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: s(20), backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', flexDirection: 'row', alignItems: 'center', gap: s(4) },
  chipAllergen: { borderColor: '#4a1a1a', backgroundColor: '#2a0a0a' },
  chipConcern: { borderColor: '#3a1a00', backgroundColor: '#1e0e00' },
  chipText:   { fontSize: s(12), color: '#aaa', maxWidth: s(140) },
  chipArrow:  { fontSize: s(12), color: '#555' },

  feedbackBtn: { borderWidth: 1, borderColor: '#2a2a2a', borderRadius: s(20), paddingHorizontal: s(14), paddingVertical: s(7) },
  feedbackBtnText: { fontSize: s(12), color: '#666', fontWeight: '500' },

  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), paddingTop: s(14), borderTopWidth: 1, borderTopColor: '#1e1e1e', backgroundColor: '#111' },
  footerText: { fontSize: s(14), color: '#888', textDecorationLine: 'underline' },

  retryBtn:   { marginTop: s(16), paddingHorizontal: s(20), paddingVertical: s(10), backgroundColor: '#222', borderRadius: s(12) },

  feedbackInput: { backgroundColor: '#111', borderRadius: s(12), borderWidth: 1, borderColor: '#333', padding: s(12), color: '#fff', fontSize: s(14), minHeight: s(100), textAlignVertical: 'top', marginBottom: s(6) },
});
