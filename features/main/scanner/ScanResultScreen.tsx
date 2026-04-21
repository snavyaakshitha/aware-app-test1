/**
 * Scan Result — redesigned for clarity and personalisation.
 *
 * Sections (top → bottom):
 *  1. Product hero (image / name / brand)
 *  2. Score card  + plain-English verdict
 *  3. Your health flags (personalised, linked to user profile)
 *  4. Why this score (transparent breakdown)
 *  5. Data labels  (NOVA + Nutri-Score badges)
 *  6. Ingredients  (parsed chips, colour-coded)
 *  7. Disclaimer
 *
 * Data sources:
 *  - prefs     → Supabase user_profiles (allergens, health conditions, diets)
 *  - obData    → AsyncStorage @aware_onboarding_data (severity, intolerances, etc.)
 *  - off       → Open Food Facts snapshot
 *  - fit       → scoreProductForProfile (deterministic scoring)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Colors, Font, s, Radius, scoreColor, scoreLabel } from '../../../shared/theme';
import { getProductById } from '../../../shared/mockData';
import { fetchProductByBarcode } from '../../../shared/productCatalog';
import { scoreProductForProfile, type OffProductSnapshot, type HealthFitResult } from '../../../shared/openFoodFacts';
import { fetchUserPreferences, getCurrentUser } from '../../../shared/supabase';
import { loadAIResult, fetchCachedProduct } from '../../../shared/aiProduct';
import type { ScannerStackParamList, UserPreferences } from '../../../shared/types';
import type { OnboardingData } from '../../../shared/onboardingTypes';

type Props = NativeStackScreenProps<ScannerStackParamList, 'ScanResult'>;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'mock'; product: NonNullable<ReturnType<typeof getProductById>> }
  | { kind: 'off'; off: OffProductSnapshot; fit: HealthFitResult; prefs: Partial<UserPreferences> | null; obData: OnboardingData | null };

// ─── Helper types ─────────────────────────────────────────────────────────────

interface PersonalFlag {
  level: 'danger' | 'warning' | 'info';
  title: string;
  subtitle: string;
}

interface BreakdownItem {
  label: string;
  delta: number;
  isBase?: boolean;
  isFinal?: boolean;
  isPositive?: boolean;
}

interface IngredientChip {
  name: string;
  flag: 'allergen' | 'concern' | 'ok';
  reason?: string;
}

// ─── Constant maps ────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  pcos: 'PCOS', hypothyroidism: 'Hypothyroidism', hyperthyroidism: 'Hyperthyroidism',
  lactose_intolerance: 'Lactose Intolerance', celiac: 'Celiac Disease',
  gluten_sensitivity: 'Gluten Sensitivity', ibs: 'IBS', ibd: 'IBD', gerd: 'GERD',
  diabetes_t2: 'Type 2 Diabetes', pre_diabetes: 'Pre-Diabetes',
  high_cholesterol: 'High Cholesterol', eczema: 'Eczema', psoriasis: 'Psoriasis',
  acne: 'Acne', asthma: 'Asthma', migraines: 'Migraines',
  anxiety_depression: 'Anxiety / Depression', autoimmune: 'Autoimmune', candida: 'Candida',
};

const ALLERGEN_CHIP_KEYWORDS: Record<string, string[]> = {
  gluten: ['wheat', 'barley', 'rye', 'gluten', 'spelt', 'semolina', 'kamut'],
  dairy: ['milk', 'cream', 'butter', 'whey', 'casein', 'lactose', 'cheese', 'yogurt', 'skimmed milk'],
  eggs: ['egg', 'albumin', 'lysozyme', 'mayonnaise'],
  peanuts: ['peanut', 'groundnut', 'arachis'],
  tree_nuts: ['hazelnut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'brazil nut', 'macadamia'],
  soy: ['soy', 'soya', 'tofu', 'tempeh', 'miso', 'edamame', 'lecithin (soy)'],
  sesame: ['sesame', 'tahini'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'scallop'],
  fish: ['fish', 'tuna', 'salmon', 'cod', 'anchovy', 'sardine'],
  corn: ['corn', 'maize', 'cornstarch', 'corn syrup'],
  sulfites: ['sulphite', 'sulfite', 'sulphur dioxide', 'sulfur dioxide'],
};

const CONCERN_CHIP_KEYWORDS = [
  'palm oil', 'high fructose', 'hfcs', 'glucose-fructose',
  'partially hydrogenated', 'trans fat',
  'aspartame', 'sucralose', 'saccharin', 'acesulfame',
  'artificial flavour', 'artificial flavor', 'artificial colour', 'artificial color',
  'carrageenan', 'maltodextrin', 'msg', 'monosodium glutamate',
  'bha', 'bht', 'tbhq', 'sodium nitrate', 'sodium nitrite',
  'modified starch', 'corn syrup', 'polysorbate',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildVerdict(fit: HealthFitResult): string {
  const { healthScore, allergensHit, concerns } = fit;
  if (allergensHit.length >= 2)
    return `Contains ${allergensHit.length} ingredients you're allergic to. Avoid or verify carefully.`;
  if (allergensHit.length === 1)
    return `Contains an allergen that matches your profile. Review before consuming.`;
  if (healthScore >= 80 && concerns.length === 0)
    return 'No red flags found for your health profile.';
  if (healthScore >= 70)
    return `Generally OK for you, but ${concerns.length} thing${concerns.length > 1 ? 's' : ''} worth checking.`;
  if (healthScore >= 50)
    return 'A few concerns noted. See your personal flags below.';
  return 'Multiple concerns for your profile. Check the details carefully.';
}

function cleanConcernLabel(concern: string): string {
  if (concern.includes('Ultra-processed')) return 'Ultra-processed food (NOVA 4)';
  if (concern.includes('glycemic') || concern.includes('diabetes'))
    return 'High glycemic ingredients (sugar, syrup)';
  if (concern.includes('Sodium') || concern.includes('sodium') || concern.includes('blood pressure'))
    return 'High sodium / salt content';
  if (concern.includes('palm oil')) return 'Contains palm oil';
  if (concern.includes('avoided ingredient')) {
    const m = concern.match(/pattern: (.+)$/);
    return m ? `Flagged: ${m[1].replace(/_/g, ' ')}` : 'Flagged ingredient in your avoid list';
  }
  if (concern.includes('custom avoid')) {
    const m = concern.match(/"(.+)"/);
    return m ? `Your avoid: "${m[1]}"` : 'Custom avoided ingredient';
  }
  return concern.length > 55 ? concern.slice(0, 55) + '…' : concern;
}

function buildPersonalizedFlags(
  fit: HealthFitResult,
  prefs: Partial<UserPreferences> | null,
  obData: OnboardingData | null,
): PersonalFlag[] {
  const flags: PersonalFlag[] = [];
  const conditions = (prefs?.healthConditions ?? []) as string[];

  // Allergen flags (most critical — always show first)
  for (const allergenName of fit.allergensHit) {
    // Look up severity from onboarding data
    const entry = obData?.foodAllergies?.find((a) => {
      const n = a.name.toLowerCase();
      return n.includes(allergenName.toLowerCase()) ||
        allergenName.toLowerCase().includes(n.split('/')[0].trim().toLowerCase());
    });
    const severity = entry?.severity;
    const severityLabel = severity === 'severe' ? '🚨 SEVERE' : severity === 'moderate' ? '⚠️ MODERATE' : '⚠️';
    const severityText = severity ? ` — you marked this as a ${severity} allergen` : ' — matches your allergen profile';

    flags.push({
      level: severity === 'severe' ? 'danger' : 'warning',
      title: `Contains ${allergenName}${severity === 'severe' ? ' — AVOID' : ''}`,
      subtitle: `${severityLabel}${severityText}`,
    });
  }

  // Concern flags — map to clean, condition-aware explanations
  for (const concern of fit.concerns) {
    if (concern.includes('Ultra-processed')) {
      flags.push({
        level: 'warning',
        title: 'Ultra-processed food',
        subtitle: 'NOVA Group 4 — highly engineered ingredients. Linked to poor long-term health.',
      });
    } else if (concern.includes('glycemic') || concern.includes('diabetes')) {
      const condLabel = conditions.includes('diabetes_t2') ? 'Type 2 Diabetes'
        : conditions.includes('pre_diabetes') ? 'Pre-Diabetes'
        : conditions.includes('pcos') ? 'PCOS'
        : 'your condition';
      flags.push({
        level: 'warning',
        title: 'High glycemic ingredients',
        subtitle: `Contains sugar or high-GI syrups — may spike blood sugar, relevant for ${condLabel}.`,
      });
    } else if (concern.includes('Sodium') || concern.includes('sodium')) {
      flags.push({
        level: 'warning',
        title: 'High sodium content',
        subtitle: 'Salt-heavy ingredients — relevant for blood pressure and heart health.',
      });
    } else if (concern.includes('palm oil')) {
      flags.push({
        level: 'info',
        title: 'Contains palm oil',
        subtitle: 'Environmental and processing concern. Some people avoid it.',
      });
    } else if (concern.includes('avoided ingredient')) {
      const m = concern.match(/pattern: (.+)$/);
      const name = m ? m[1].replace(/_/g, ' ') : 'an ingredient';
      flags.push({
        level: 'warning',
        title: `Contains ${name}`,
        subtitle: 'This is on your personal avoid list from your health profile.',
      });
    } else if (concern.includes('custom avoid')) {
      const m = concern.match(/"(.+)"/);
      const name = m ? m[1] : 'a custom ingredient';
      flags.push({
        level: 'warning',
        title: `Contains "${name}"`,
        subtitle: 'You manually added this to your avoid list.',
      });
    }
  }

  return flags;
}

function buildScoreBreakdown(fit: HealthFitResult): BreakdownItem[] {
  const items: BreakdownItem[] = [{ label: 'Starting score', delta: 88, isBase: true }];

  for (const allergen of fit.allergensHit) {
    items.push({ label: `Allergen found: ${allergen}`, delta: -22 });
  }
  for (const concern of fit.concerns) {
    items.push({ label: cleanConcernLabel(concern), delta: -8 });
  }
  for (const positive of fit.positives) {
    items.push({ label: positive, delta: 0, isPositive: true });
  }

  items.push({ label: 'Your score', delta: fit.healthScore, isFinal: true });
  return items;
}

/** Parse ingredient text into individual chips with flag level. */
function parseIngredients(
  text: string,
  userAllergens: string[],
): IngredientChip[] {
  if (!text.trim()) return [];
  // Split on top-level commas (respecting parentheses)
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if ((ch === ',' || ch === ';') && depth === 0) {
      const t = cur.trim();
      if (t) parts.push(t);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  return parts.map((rawName) => {
    const name = rawName.replace(/\s+/g, ' ').trim();
    const lower = name.toLowerCase();

    // Allergen check (highest priority)
    for (const allergen of userAllergens) {
      const kws = ALLERGEN_CHIP_KEYWORDS[allergen] ?? [];
      if (kws.some((kw) => lower.includes(kw))) {
        return {
          name,
          flag: 'allergen' as const,
          reason: String(allergen).replace(/_/g, ' '),
        };
      }
    }

    // Concern check
    for (const kw of CONCERN_CHIP_KEYWORDS) {
      if (lower.includes(kw)) {
        return { name, flag: 'concern' as const, reason: kw };
      }
    }

    return { name, flag: 'ok' as const };
  });
}

// ─── NOVA / Nutriscore data ───────────────────────────────────────────────────

const NOVA_DATA: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: 'NOVA 1', color: '#22C55E', desc: 'Unprocessed / minimal' },
  2: { label: 'NOVA 2', color: '#86EFAC', desc: 'Culinary ingredient' },
  3: { label: 'NOVA 3', color: '#F59E0B', desc: 'Processed food' },
  4: { label: 'NOVA 4', color: '#EF4444', desc: 'Ultra-processed' },
};

const NUTRISCORE_DATA: Record<string, { color: string; desc: string }> = {
  a: { color: '#22C55E', desc: 'Excellent nutrition' },
  b: { color: '#86EFAC', desc: 'Good nutrition' },
  c: { color: '#F59E0B', desc: 'Average nutrition' },
  d: { color: '#F97316', desc: 'Poor nutrition' },
  e: { color: '#EF4444', desc: 'Very poor nutrition' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function FlagCard({ flag }: { flag: PersonalFlag }) {
  const borderColor = flag.level === 'danger'
    ? 'rgba(239,68,68,0.4)'
    : flag.level === 'warning'
    ? 'rgba(245,158,11,0.4)'
    : 'rgba(56,189,248,0.3)';
  const bgColor = flag.level === 'danger'
    ? 'rgba(239,68,68,0.08)'
    : flag.level === 'warning'
    ? 'rgba(245,158,11,0.07)'
    : 'rgba(56,189,248,0.07)';
  const titleColor = flag.level === 'danger' ? Colors.scoreAvoid
    : flag.level === 'warning' ? Colors.scoreCaution
    : Colors.info;
  const icon = flag.level === 'danger' ? '🚨' : flag.level === 'warning' ? '⚠️' : 'ℹ️';

  return (
    <View style={[styles.flagCard, { borderColor, backgroundColor: bgColor }]}>
      <Text style={styles.flagIcon}>{icon}</Text>
      <View style={styles.flagBody}>
        <Text style={[styles.flagTitle, { color: titleColor }]}>{flag.title}</Text>
        <Text style={styles.flagSubtitle}>{flag.subtitle}</Text>
      </View>
    </View>
  );
}

function BreakdownRow({ item }: { item: BreakdownItem }) {
  if (item.isBase) {
    return (
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownBase}>Start</Text>
        <Text style={styles.breakdownBaseValue}>+{item.delta}</Text>
      </View>
    );
  }
  if (item.isFinal) {
    return (
      <View style={[styles.breakdownRow, styles.breakdownFinalRow]}>
        <Text style={styles.breakdownFinalLabel}>Your score</Text>
        <Text style={[styles.breakdownFinalValue, { color: scoreColor(item.delta) }]}>
          {item.delta}
        </Text>
      </View>
    );
  }
  if (item.isPositive) {
    return (
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownDotPositive} />
        <Text style={styles.breakdownPositiveText}>{item.label}</Text>
      </View>
    );
  }
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownDelta}>{item.delta}</Text>
      <Text style={styles.breakdownLabel}>{item.label}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScanResultScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { productId, barcode } = route.params ?? {};
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [showAllIngredients, setShowAllIngredients] = useState(false);

  const load = useCallback(async () => {
    if (barcode) {
      setState({ kind: 'loading' });

      // Fetch user profile + onboarding data in parallel
      const [userResult, obRaw] = await Promise.all([
        getCurrentUser().catch(() => null),
        AsyncStorage.getItem('@aware_onboarding_data').catch(() => null),
      ]);

      let prefs: Partial<UserPreferences> | null = null;
      if (userResult) {
        prefs = await fetchUserPreferences(userResult.id).catch(() => null);
      }
      const obData: OnboardingData | null = obRaw ? JSON.parse(obRaw) as OnboardingData : null;

      // 1. Check our Supabase products cache first (fastest path for repeat scans)
      const cached = await fetchCachedProduct(barcode);
      if (cached?.ok) {
        const fit = scoreProductForProfile(cached.product, mergedPrefs);
        setState({ kind: 'off', off: cached.product, fit, prefs: mergedPrefs, obData });
        return;
      }

      // 2. Try external APIs (OFF → OBF → OPF → USDA → openFDA)
      const res = await fetchProductByBarcode(barcode);
      if (!res.ok) {
        // 3. Fall back to locally cached AI result (set by AIFallbackScreen)
        const aiSnapshot = await loadAIResult(barcode);
        if (aiSnapshot) {
          const fit = scoreProductForProfile(aiSnapshot, mergedPrefs);
          setState({ kind: 'off', off: aiSnapshot, fit, prefs: mergedPrefs, obData });
          return;
        }
        setState({ kind: 'error', message: res.message || 'Product not found' });
        return;
      }

      // Merge allergens: Supabase allergens + onboarding food allergies
      const mergedPrefs: Partial<UserPreferences> = { ...prefs };
      if (obData?.foodAllergies?.length) {
        const obAllergenNames = obData.foodAllergies.map((a) => a.name.toLowerCase());
        // Add any extra allergens found in onboarding that aren't in Supabase
        const existing = (prefs?.allergens ?? []) as string[];
        const extras: string[] = [];
        if (obAllergenNames.some((n) => n.includes('milk') || n.includes('dairy')) && !existing.includes('dairy')) extras.push('dairy');
        if (obAllergenNames.some((n) => n.includes('wheat') || n.includes('gluten')) && !existing.includes('gluten')) extras.push('gluten');
        if (obAllergenNames.some((n) => n.includes('peanut')) && !existing.includes('peanuts')) extras.push('peanuts');
        if (obAllergenNames.some((n) => n.includes('tree nut') || n.includes('nut')) && !existing.includes('tree_nuts')) extras.push('tree_nuts');
        if (obAllergenNames.some((n) => n.includes('egg')) && !existing.includes('eggs')) extras.push('eggs');
        if (obAllergenNames.some((n) => n.includes('soy')) && !existing.includes('soy')) extras.push('soy');
        if (obAllergenNames.some((n) => n.includes('sesame')) && !existing.includes('sesame')) extras.push('sesame');
        if (extras.length) {
          mergedPrefs.allergens = [...existing, ...extras] as any;
        }
      }

      const fit = scoreProductForProfile(res.product, mergedPrefs);
      setState({ kind: 'off', off: res.product, fit, prefs: mergedPrefs, obData });
      return;
    }

    if (productId) {
      const product = getProductById(productId);
      if (!product) {
        setState({ kind: 'error', message: 'Product not found' });
        return;
      }
      setState({ kind: 'mock', product });
      return;
    }

    setState({ kind: 'error', message: 'Missing scan data' });
  }, [barcode, productId]);

  useEffect(() => { void load(); }, [load]);

  // ── Shared header ─────────────────────────────────────────────────────────
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + s(8) }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={s(24)} color={Colors.textWhite} />
      </Pressable>
      <Text style={styles.headerTitle}>Analysis</Text>
      <View style={{ width: s(40) }} />
    </View>
  );

  // ── Loading / error states ────────────────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Analysing product…</Text>
        </View>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.root}>
        {header}
        <View style={styles.centered}>
          <Text style={{ fontSize: s(48) }}>🔍</Text>
          <Text style={styles.errorTitle}>{state.message}</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Mock catalog product (simplified view) ────────────────────────────────
  if (state.kind === 'mock') {
    const product = state.product;
    const sc = scoreColor(product.cleanScore);
    return (
      <View style={styles.root}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.mockHero}>
            <Text style={{ fontSize: s(72) }}>{product.emoji}</Text>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.brandName}>{product.brand}</Text>
          </View>
          <View style={[styles.scoreCard, { borderColor: sc + '55' }]}>
            <View style={[styles.scoreCircle, { borderColor: sc }]}>
              <Text style={[styles.scoreNum, { color: sc }]}>{product.cleanScore}</Text>
              <Text style={[styles.scoreLbl, { color: sc }]}>{scoreLabel(product.cleanScore)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verdict}>
                {product.ingredientConcerns.length === 0
                  ? 'No ingredient concerns found in catalog data.'
                  : `${product.ingredientConcerns.length} ingredient concern${product.ingredientConcerns.length > 1 ? 's' : ''} in catalog.`}
              </Text>
            </View>
          </View>
          <Text style={styles.disclaimer}>This is demo/catalog data, not a live scan.</Text>
        </ScrollView>
        <Pressable onPress={() => navigation.goBack()} style={styles.scanAgainBtn}>
          <Ionicons name="scan-outline" size={s(16)} color={Colors.textMuted} />
          <Text style={styles.scanAgainText}>Scan another product</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main: Open Food Facts product ─────────────────────────────────────────
  const { off, fit, prefs, obData } = state;
  const sc = scoreColor(fit.healthScore);
  const hasConcerns = fit.concerns.length > 0 || fit.allergensHit.length > 0;
  const isAIResult =
    off.catalogSource === 'ai_gemini' || off.catalogSource === 'ai_gpt';
  const flags = buildPersonalizedFlags(fit, prefs, obData);
  const breakdown = buildScoreBreakdown(fit);
  const userAllergens = (prefs?.allergens ?? []) as string[];
  const chips = parseIngredients(off.ingredientsText, userAllergens);
  const flaggedChips = chips.filter((c) => c.flag !== 'ok');
  const okChips = chips.filter((c) => c.flag === 'ok');
  const visibleOkChips = showAllIngredients ? okChips : okChips.slice(0, 12);
  const novaInfo = off.novaGroup ? NOVA_DATA[off.novaGroup] : null;
  const nutriInfo = off.nutriscoreGrade ? NUTRISCORE_DATA[off.nutriscoreGrade.toLowerCase()] : null;

  return (
    <View style={styles.root}>
      <View style={styles.bgDecor} />
      {header}

      {/* Source badge */}
      <View style={styles.sourceBadge}>
        <Feather name="package" size={s(11)} color={Colors.accent} />
        <Text style={styles.sourceText}>
          {off.catalogSourceLabel ?? 'Open Food Facts'} · {off.code}
        </Text>
      </View>

      {/* AI disclaimer banner — only shown for AI-extracted results */}
      {isAIResult && (
        <View style={styles.aiDisclaimer}>
          <Text style={styles.aiDisclaimerIcon}>🤖</Text>
          <View style={styles.aiDisclaimerBody}>
            <Text style={styles.aiDisclaimerTitle}>AI-generated result</Text>
            <Text style={styles.aiDisclaimerSub}>
              Extracted from your photos by{' '}
              {off.catalogSource === 'ai_gpt' ? 'GPT-4o mini' : 'Gemini 2.0 Flash'}.
              Always verify allergens on the physical package.
            </Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 1. Product hero ────────────────────────────────────────── */}
        <View style={styles.hero}>
          {off.imageUrl ? (
            <Image source={{ uri: off.imageUrl }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <View style={styles.emojiPlaceholder}>
              <Text style={{ fontSize: s(52) }}>📦</Text>
            </View>
          )}
          <View style={styles.heroText}>
            <Text style={styles.productName} numberOfLines={3}>{off.productName}</Text>
            <Text style={styles.brandName}>{off.brand}</Text>
          </View>
        </View>

        {/* ── 2. Score card ──────────────────────────────────────────── */}
        <View style={[styles.scoreCard, { borderColor: sc + '44' }]}>
          <View style={[styles.scoreCircle, { borderColor: sc }]}>
            <Text style={[styles.scoreNum, { color: sc }]}>{fit.healthScore}</Text>
            <Text style={[styles.scoreLbl, { color: sc }]}>{scoreLabel(fit.healthScore)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreMeta}>Your health score</Text>
            <Text style={styles.verdict}>{buildVerdict(fit)}</Text>
          </View>
        </View>

        {/* ── 3. Personal flags (only if there are flags) ───────────── */}
        {flags.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>YOUR HEALTH FLAGS</SectionLabel>
            <View style={styles.flagList}>
              {flags.map((flag, i) => <FlagCard key={i} flag={flag} />)}
            </View>
          </View>
        )}

        {/* All clear badge when no flags */}
        {flags.length === 0 && (
          <View style={styles.allClearCard}>
            <Text style={styles.allClearIcon}>✅</Text>
            <View>
              <Text style={styles.allClearTitle}>All clear for your profile</Text>
              <Text style={styles.allClearSub}>No allergens or flagged ingredients detected.</Text>
            </View>
          </View>
        )}

        {/* ── 4. Score breakdown ─────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>WHY THIS SCORE?</SectionLabel>
          <View style={styles.breakdownCard}>
            {breakdown.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && !item.isFinal && <View style={styles.breakdownDivider} />}
                {item.isFinal && <View style={styles.breakdownTotalDivider} />}
                <BreakdownRow item={item} />
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── 5. Data labels ─────────────────────────────────────────── */}
        {(novaInfo || nutriInfo) && (
          <View style={styles.section}>
            <SectionLabel>DATA LABELS</SectionLabel>
            <View style={styles.badgeRow}>
              {novaInfo && (
                <View style={[styles.dataBadge, { borderColor: novaInfo.color + '55', backgroundColor: novaInfo.color + '15' }]}>
                  <Text style={[styles.dataBadgeLabel, { color: novaInfo.color }]}>{novaInfo.label}</Text>
                  <Text style={styles.dataBadgeDesc}>{novaInfo.desc}</Text>
                </View>
              )}
              {nutriInfo && off.nutriscoreGrade && (
                <View style={[styles.dataBadge, { borderColor: nutriInfo.color + '55', backgroundColor: nutriInfo.color + '15' }]}>
                  <Text style={[styles.dataBadgeLabel, { color: nutriInfo.color }]}>
                    Nutri-Score {off.nutriscoreGrade.toUpperCase()}
                  </Text>
                  <Text style={styles.dataBadgeDesc}>{nutriInfo.desc}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── 6. Positives ───────────────────────────────────────────── */}
        {fit.positives.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>POSITIVES</SectionLabel>
            <View style={styles.positiveRow}>
              {fit.positives.map((p, i) => (
                <View key={i} style={styles.positiveChip}>
                  <Text style={styles.positiveChipText}>✓ {p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 6b. Nutrition facts (AI results only) ──────────────────── */}
        {isAIResult && off.nutritionFacts && (
          (() => {
            const nf = off.nutritionFacts!;
            const rows: Array<{ label: string; value: string | null }> = [
              { label: 'Calories',      value: nf.calories },
              { label: 'Fat',           value: nf.fat },
              { label: 'Carbohydrates', value: nf.carbohydrates },
              { label: 'Protein',       value: nf.protein },
              { label: 'Sodium',        value: nf.sodium },
              { label: 'Sugar',         value: nf.sugar },
              { label: 'Fiber',         value: nf.fiber },
            ].filter((r) => r.value != null);

            if (rows.length === 0) return null;

            return (
              <View style={styles.section}>
                <SectionLabel>NUTRITION FACTS{nf.serving_size ? ` (${nf.serving_size})` : ''}</SectionLabel>
                <View style={styles.nutritionCard}>
                  {rows.map((row, i) => (
                    <React.Fragment key={row.label}>
                      {i > 0 && <View style={styles.nutritionDivider} />}
                      <View style={styles.nutritionRow}>
                        <Text style={styles.nutritionLabel}>{row.label}</Text>
                        <Text style={styles.nutritionValue}>{row.value}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            );
          })()
        )}

        {/* ── 7. Ingredients ─────────────────────────────────────────── */}
        {chips.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>INGREDIENTS</SectionLabel>
            {flaggedChips.length > 0 && (
              <Text style={styles.ingredientNote}>
                {flaggedChips.length} ingredient{flaggedChips.length > 1 ? 's' : ''} flagged for your profile
              </Text>
            )}
            <View style={styles.chipGrid}>
              {flaggedChips.map((chip, i) => (
                <View
                  key={`flag-${i}`}
                  style={[
                    styles.chip,
                    chip.flag === 'allergen' ? styles.chipAllergen : styles.chipConcern,
                  ]}
                >
                  <Text style={[
                    styles.chipText,
                    chip.flag === 'allergen' ? styles.chipTextAllergen : styles.chipTextConcern,
                  ]} numberOfLines={1}>
                    {chip.name.length > 28 ? chip.name.slice(0, 28) + '…' : chip.name}
                  </Text>
                </View>
              ))}
              {visibleOkChips.map((chip, i) => (
                <View key={`ok-${i}`} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {chip.name.length > 28 ? chip.name.slice(0, 28) + '…' : chip.name}
                  </Text>
                </View>
              ))}
            </View>
            {okChips.length > 12 && (
              <Pressable
                onPress={() => setShowAllIngredients((v) => !v)}
                style={styles.showMoreBtn}
              >
                <Text style={styles.showMoreText}>
                  {showAllIngredients
                    ? 'Show fewer ingredients'
                    : `Show all ${okChips.length} clean ingredients ↓`}
                </Text>
              </Pressable>
            )}
          </View>
        ) : off.ingredientsText.trim() ? (
          <View style={styles.section}>
            <SectionLabel>INGREDIENTS</SectionLabel>
            <Text style={styles.ingredientsRaw}>{off.ingredientsText}</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <SectionLabel>INGREDIENTS</SectionLabel>
            <Text style={styles.ingredientsMissing}>
              No ingredient list available from {off.catalogSourceLabel ?? 'this database'}. Always check the package.
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Not medical advice. Data from {off.catalogSourceLabel ?? 'Open Food Facts'} — may be incomplete. Always verify allergens on the physical package.
        </Text>

        <View style={{ height: s(80) }} />
      </ScrollView>

      {/* Footer */}
      <Pressable onPress={() => navigation.goBack()} style={[styles.scanAgainBtn, { paddingBottom: insets.bottom + s(12) }]}>
        <Ionicons name="scan-outline" size={s(16)} color={Colors.textMuted} />
        <Text style={styles.scanAgainText}>Scan another product</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvasDark,
  },
  bgDecor: {
    position: 'absolute',
    width: s(500),
    height: s(500),
    borderRadius: s(250),
    backgroundColor: '#79FFA8',
    top: s(-150),
    left: s(-100),
    opacity: 0.07,
    ...Platform.select({ web: { filter: `blur(${s(200)}px)` } as object }),
  },

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingBottom: s(12),
    zIndex: 10,
  },
  backBtn: {
    width: s(40), height: s(40),
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Font.bold,
    fontSize: s(17),
    color: Colors.textWhite,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    alignSelf: 'center',
    backgroundColor: 'rgba(139,197,61,0.10)',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.22)',
    paddingHorizontal: s(12),
    paddingVertical: s(4),
    marginBottom: s(12),
  },
  sourceText: {
    fontFamily: Font.regular,
    fontSize: s(11),
    color: Colors.accent,
  },

  // ── AI disclaimer ─────────────────────────────────────────────────────
  aiDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(10),
    marginHorizontal: s(16),
    marginBottom: s(10),
    padding: s(12),
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  aiDisclaimerIcon: { fontSize: s(18), marginTop: s(1) },
  aiDisclaimerBody: { flex: 1 },
  aiDisclaimerTitle: {
    fontFamily: Font.bold,
    fontSize: s(13),
    color: Colors.info,
    marginBottom: s(2),
  },
  aiDisclaimerSub: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
    lineHeight: s(17),
  },

  // ── Nutrition facts ───────────────────────────────────────────────────
  nutritionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(14),
    paddingVertical: s(9),
  },
  nutritionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  nutritionLabel: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
  },
  nutritionValue: {
    fontFamily: Font.bold,
    fontSize: s(13),
    color: Colors.textOffWhite,
  },

  // ── Loading / Error ───────────────────────────────────────────────────
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: s(12), padding: s(24),
  },
  loadingText: {
    fontFamily: Font.regular, fontSize: s(15), color: Colors.textMuted,
  },
  errorTitle: {
    fontFamily: Font.bold, fontSize: s(18),
    color: Colors.textWhite, textAlign: 'center',
  },
  retryBtn: {
    marginTop: s(8), paddingHorizontal: s(20), paddingVertical: s(10),
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.md,
  },
  retryBtnText: {
    fontFamily: Font.medium, fontSize: s(15), color: Colors.textWhite,
  },

  // ── Scroll ────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: s(16),
    paddingBottom: s(20),
  },

  // ── Hero ──────────────────────────────────────────────────────────────
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(14),
    marginBottom: s(16),
    padding: s(14),
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productImage: {
    width: s(72), height: s(72),
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  emojiPlaceholder: {
    width: s(72), height: s(72),
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  heroText: { flex: 1 },
  productName: {
    fontFamily: Font.bold,
    fontSize: s(17),
    color: Colors.textWhite,
    lineHeight: s(24),
    marginBottom: s(4),
  },
  brandName: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
  },
  mockHero: {
    alignItems: 'center',
    paddingVertical: s(24),
    gap: s(8),
  },

  // ── Score card ────────────────────────────────────────────────────────
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(16),
    padding: s(16),
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    marginBottom: s(16),
  },
  scoreCircle: {
    width: s(72), height: s(72),
    borderRadius: s(36),
    borderWidth: s(3),
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  scoreNum: {
    fontFamily: Font.bold, fontSize: s(26), lineHeight: s(30),
  },
  scoreLbl: {
    fontFamily: Font.regular, fontSize: s(9), lineHeight: s(12),
  },
  scoreMeta: {
    fontFamily: Font.regular, fontSize: s(11),
    color: Colors.textFaint, marginBottom: s(4), textTransform: 'uppercase', letterSpacing: 0.5,
  },
  verdict: {
    fontFamily: Font.medium,
    fontSize: s(14),
    color: Colors.textOffWhite,
    lineHeight: s(20),
  },

  // ── Sections ──────────────────────────────────────────────────────────
  section: {
    marginBottom: s(20),
  },
  sectionLabel: {
    fontFamily: Font.bold,
    fontSize: s(11),
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: s(10),
  },

  // ── Personal flags ────────────────────────────────────────────────────
  flagList: { gap: s(8) },
  flagCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(12),
    padding: s(12),
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  flagIcon: { fontSize: s(18), marginTop: s(1) },
  flagBody: { flex: 1 },
  flagTitle: {
    fontFamily: Font.bold,
    fontSize: s(14),
    lineHeight: s(20),
    marginBottom: s(2),
  },
  flagSubtitle: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    lineHeight: s(18),
  },
  allClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    padding: s(14),
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.07)',
    marginBottom: s(20),
  },
  allClearIcon: { fontSize: s(24) },
  allClearTitle: {
    fontFamily: Font.bold, fontSize: s(14), color: Colors.scoreClean,
    marginBottom: s(2),
  },
  allClearSub: {
    fontFamily: Font.regular, fontSize: s(12), color: Colors.textMuted,
  },

  // ── Score breakdown ───────────────────────────────────────────────────
  breakdownCard: {
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: s(4),
    paddingHorizontal: s(14),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(9),
    gap: s(10),
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  breakdownTotalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: s(2),
  },
  breakdownBase: {
    fontFamily: Font.regular, fontSize: s(13), color: Colors.textMuted,
    width: s(36),
  },
  breakdownBaseValue: {
    fontFamily: Font.bold, fontSize: s(13), color: Colors.textMuted,
  },
  breakdownDelta: {
    fontFamily: Font.bold, fontSize: s(13),
    color: Colors.scoreAvoid,
    width: s(36),
    textAlign: 'right',
  },
  breakdownLabel: {
    fontFamily: Font.regular, fontSize: s(13), color: Colors.textOffWhite,
    flex: 1, lineHeight: s(18),
  },
  breakdownFinalRow: {
    paddingTop: s(10),
  },
  breakdownFinalLabel: {
    fontFamily: Font.bold, fontSize: s(14), color: Colors.textWhite,
    flex: 1,
  },
  breakdownFinalValue: {
    fontFamily: Font.bold, fontSize: s(22),
  },
  breakdownDotPositive: {
    width: s(6), height: s(6),
    borderRadius: s(3),
    backgroundColor: Colors.scoreClean,
    marginLeft: s(6),
  },
  breakdownPositiveText: {
    fontFamily: Font.regular, fontSize: s(13), color: Colors.scoreClean,
    flex: 1,
  },

  // ── Data badges ───────────────────────────────────────────────────────
  badgeRow: {
    flexDirection: 'row',
    gap: s(10),
    flexWrap: 'wrap',
  },
  dataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingHorizontal: s(14),
    paddingVertical: s(10),
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexShrink: 1,
  },
  dataBadgeLabel: {
    fontFamily: Font.bold, fontSize: s(13),
  },
  dataBadgeDesc: {
    fontFamily: Font.regular, fontSize: s(11), color: Colors.textMuted,
  },

  // ── Positives ─────────────────────────────────────────────────────────
  positiveRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: s(8),
  },
  positiveChip: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    paddingHorizontal: s(12), paddingVertical: s(6),
  },
  positiveChipText: {
    fontFamily: Font.medium, fontSize: s(13), color: Colors.scoreClean,
  },

  // ── Ingredient chips ──────────────────────────────────────────────────
  ingredientNote: {
    fontFamily: Font.regular, fontSize: s(12),
    color: Colors.scoreCaution,
    marginBottom: s(8),
  },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: s(6),
  },
  chip: {
    paddingHorizontal: s(10), paddingVertical: s(5),
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chipAllergen: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  chipConcern: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.30)',
  },
  chipText: {
    fontFamily: Font.regular, fontSize: s(12), color: Colors.textMuted,
  },
  chipTextAllergen: {
    color: Colors.scoreAvoid, fontFamily: Font.medium,
  },
  chipTextConcern: {
    color: Colors.scoreCaution, fontFamily: Font.medium,
  },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: s(10),
    marginTop: s(4),
  },
  showMoreText: {
    fontFamily: Font.regular, fontSize: s(13),
    color: Colors.accent, textDecorationLine: 'underline',
  },
  ingredientsRaw: {
    fontFamily: Font.regular, fontSize: s(13),
    color: 'rgba(255,255,255,0.65)',
    lineHeight: s(20),
  },
  ingredientsMissing: {
    fontFamily: Font.regular, fontSize: s(13),
    color: Colors.textFaint, fontStyle: 'italic',
  },

  // ── Footer ────────────────────────────────────────────────────────────
  disclaimer: {
    fontFamily: Font.regular, fontSize: s(11),
    color: Colors.textFaint, lineHeight: s(16),
    textAlign: 'center',
    marginTop: s(8),
    paddingHorizontal: s(8),
  },
  scanAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    paddingTop: s(14),
    paddingBottom: s(14),
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.canvasDark,
  },
  scanAgainText: {
    fontFamily: Font.regular, fontSize: s(14),
    color: Colors.textMuted, textDecorationLine: 'underline',
  },
});
