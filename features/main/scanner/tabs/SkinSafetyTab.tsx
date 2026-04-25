import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors, Font, Radius, s } from '../../../../shared/theme';
import type { SkinCareAnalysisResult, SkincareIngredientFlag, SkinType, SkinConcern } from '../../../../shared/types';

interface Props {
  analysis: SkinCareAnalysisResult;
  skinType?: SkinType | null;
  skinConcerns?: SkinConcern[];
  productName: string;
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const CONCERN_TYPE_LABELS: Record<string, string> = {
  allergen: 'Allergen',
  irritant: 'Irritant',
  endocrine_disruptor: 'Hormone Disruptor',
  comedogenic: 'Pore-clogging',
  'barrier-disruptor': 'Barrier Damage',
  sensitizer: 'Sensitizer',
  'formaldehyde-releaser': 'Formaldehyde Releaser',
  drying: 'Drying',
  environmental: 'Environmental',
  'photo-sensitizer': 'Photo-sensitizer',
  'penetration-enhancer': 'Penetration Enhancer',
  'prescription-only': 'Prescription Only',
};

const SEVERITY_COLOR: Record<string, string> = {
  severe: '#FF3B30',
  high:   '#FF9500',
  medium: '#FFCC00',
  low:    '#34C759',
};

const SEVERITY_LABEL: Record<string, string> = {
  severe: 'Severe',
  high:   'High',
  medium: 'Moderate',
  low:    'Low',
};

// ─── Editorial helpers ────────────────────────────────────────────────────────

function generateHeadline(
  flagged: SkincareIngredientFlag[],
  verdict: 'clean' | 'flag',
): string {
  if (verdict === 'clean') return 'Looks Clean';

  const severeCount    = flagged.filter((f) => f.concern_level === 'severe').length;
  const allergenCount  = flagged.filter((f) => f.concern_types.includes('allergen')).length;
  const endocrineCount = flagged.filter((f) => f.concern_types.includes('endocrine_disruptor')).length;
  const irritantCount  = flagged.filter((f) => f.concern_types.includes('irritant')).length;
  const comedoCount    = flagged.filter((f) => f.concern_types.includes('comedogenic')).length;

  if (severeCount > 0)
    return `${severeCount} Severely Flagged Ingredient${severeCount > 1 ? 's' : ''}`;
  if (allergenCount >= 2)
    return `${allergenCount} Fragrance Allergens Found`;
  if (endocrineCount > 0)
    return `${endocrineCount} Hormone Disruptor${endocrineCount > 1 ? 's' : ''} Detected`;
  if (irritantCount >= 2)
    return `${irritantCount} Potential Irritants Found`;
  if (comedoCount > 0)
    return `${comedoCount} Pore-clogging Ingredient${comedoCount > 1 ? 's' : ''} Found`;

  const dominant = getDominantConcern(flagged);
  if (dominant) {
    const label = CONCERN_TYPE_LABELS[dominant.type] ?? dominant.type;
    return `${dominant.count} ${label} Ingredient${dominant.count > 1 ? 's' : ''} Found`;
  }

  return `${flagged.length} Concern${flagged.length > 1 ? 's' : ''} Found`;
}

function getDominantConcern(flagged: SkincareIngredientFlag[]): { type: string; count: number } | null {
  const counts = new Map<string, number>();
  flagged.forEach((f) => f.concern_types.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  return { type: sorted[0][0], count: sorted[0][1] };
}

function generateAwaresTake(
  flagged: SkincareIngredientFlag[],
  verdict: 'clean' | 'flag',
  productName: string,
  skinType?: SkinType | null,
  skinConcerns?: SkinConcern[],
): string {
  if (verdict === 'clean') {
    const noParabens = !flagged.some((f) =>
      f.ingredient.toLowerCase().includes('paraben'),
    );
    const noAllergens = !flagged.some((f) => f.concern_types.includes('allergen'));
    if (noParabens && noAllergens) {
      return `No parabens, fragrance allergens, or endocrine disruptors in ${productName}. Generally suitable for most skin types.`;
    }
    return `No high-concern ingredients detected in ${productName} based on our database of flagged skincare ingredients.`;
  }

  const severe    = flagged.filter((f) => f.concern_level === 'severe');
  const allergens = flagged.filter((f) => f.concern_types.includes('allergen'));
  const endocrine = flagged.filter((f) => f.concern_types.includes('endocrine_disruptor'));
  const concerns  = skinConcerns ?? [];

  if (severe.length > 0) {
    const name = severe[0].ingredient;
    return `${name} is flagged at severe level — it's restricted or banned under EU Cosmetics Regulation.`;
  }
  if (endocrine.length > 0 && endocrine.length >= 2) {
    return `Contains ${endocrine.length} ingredients linked to hormone disruption. Long-term repeated exposure is the primary concern.`;
  }
  if (allergens.length >= 2) {
    return `The fragrance blend contains ${allergens.length} EU-listed allergens — worth avoiding if you react to fragranced products.`;
  }
  if (concerns.includes('eczema') && flagged.some((f) => f.concern_types.includes('irritant'))) {
    return `Contains irritants that are common eczema triggers. If you have eczema, patch-test before use.`;
  }
  if (skinType === 'sensitive' && allergens.length > 0) {
    return `Contains a fragrance allergen that's a known trigger for sensitive skin. Worth checking before regular use.`;
  }
  if (flagged.length === 1) {
    return `One ingredient flagged: ${flagged[0].ingredient}. Check the details below before deciding.`;
  }

  const worst = flagged[0];
  return `${worst.ingredient} is the primary concern here — flagged as ${(CONCERN_TYPE_LABELS[worst.concern_types[0]] ?? worst.concern_types[0] ?? 'concerning').toLowerCase()}.`;
}

function buildPersonalReason(
  f: SkincareIngredientFlag,
  skinType?: SkinType | null,
  concerns?: SkinConcern[],
): string {
  const cs = concerns ?? [];
  if (cs.includes('eczema') && f.concern_types.includes('irritant'))
    return 'Common eczema trigger — can worsen flares';
  if (cs.includes('acne') && f.concern_types.includes('comedogenic'))
    return 'Can clog pores — avoid if acne-prone';
  if (skinType === 'sensitive' && f.concern_types.includes('allergen'))
    return 'Fragrance allergen — heightened risk for sensitive skin';
  if (skinType === 'sensitive' && f.concern_types.includes('irritant'))
    return 'Irritant — more likely to cause reactions on sensitive skin';
  if (cs.includes('rosacea') && f.concern_types.includes('irritant'))
    return 'Can aggravate rosacea flare-ups';
  if (cs.includes('hyperpigmentation') && f.concern_types.includes('photo-sensitizer'))
    return 'Photo-sensitizer — increases sun sensitivity, worsening pigmentation risk';
  if (f.concern_types.includes('endocrine_disruptor'))
    return 'Linked to hormone disruption — limit repeated exposure';
  return f.reason ?? 'Flagged for your skin profile';
}

function getPersonalizedFlags(
  flagged: SkincareIngredientFlag[],
  skinType?: SkinType | null,
  skinConcerns?: SkinConcern[],
): { ingredient: string; reason: string; level: string }[] {
  const concerns = skinConcerns ?? [];
  const type = skinType ?? '';

  return flagged
    .filter((f) => {
      const affected = (f as any).affected_skin_types as string[] | null ?? null;
      if (!affected || affected.length === 0) return true;
      return affected.includes(type) || concerns.some((c) => affected.includes(c));
    })
    .slice(0, 4)
    .map((f) => ({
      ingredient: f.ingredient,
      reason: buildPersonalReason(f, skinType, skinConcerns),
      level: f.concern_level,
    }));
}

// ─── IngredientCard ───────────────────────────────────────────────────────────

function IngredientCard({ item }: { item: SkincareIngredientFlag }) {
  const [expanded, setExpanded] = useState(false);
  const color = SEVERITY_COLOR[item.concern_level] ?? Colors.textMuted;

  const concernLabels = item.concern_types
    .map((t) => CONCERN_TYPE_LABELS[t] ?? t)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={styles.ingredientCard}>
      <View style={styles.ingredientHeader}>
        <View style={[styles.severityDot, { backgroundColor: color }]} />
        <View style={styles.ingredientMeta}>
          <Text style={styles.ingredientName}>{item.ingredient}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.severityTag, { borderColor: color }]}>
              <Text style={[styles.severityTagText, { color }]}>
                {SEVERITY_LABEL[item.concern_level]}
              </Text>
            </View>
            {concernLabels.map((label) => (
              <View key={label} style={styles.concernTag}>
                <Text style={styles.concernTagText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          color={Colors.textMuted}
          size={s(16)}
        />
      </View>

      {expanded && (
        <View style={styles.ingredientBody}>
          <Text style={styles.ingredientReason}>{item.reason}</Text>
          {item.sources?.length > 0 && (
            <View style={styles.sourcesRow}>
              {item.sources.slice(0, 2).map((src, i) => (
                <Pressable
                  key={i}
                  onPress={() => src.url && void Linking.openURL(src.url)}
                  style={styles.sourceChip}
                >
                  <Feather name="external-link" size={s(10)} color={Colors.accent} />
                  <Text style={styles.sourceText}>{src.source_name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function SkinSafetyTab({ analysis, skinType, skinConcerns, productName }: Props) {
  const isClean   = analysis.verdict === 'clean';
  const flagged   = analysis.flagged_ingredients ?? [];
  const severe    = flagged.filter((f) => f.concern_level === 'severe');
  const high      = flagged.filter((f) => f.concern_level === 'high');
  const medium    = flagged.filter((f) => f.concern_level === 'medium');
  const low       = flagged.filter((f) => f.concern_level === 'low');

  const hasProfile = !!(skinType || skinConcerns?.length);
  const personalFlags = hasProfile
    ? getPersonalizedFlags(flagged, skinType, skinConcerns)
    : [];

  const headline   = generateHeadline(flagged, analysis.verdict);
  const awaresTake = generateAwaresTake(flagged, analysis.verdict, productName, skinType, skinConcerns);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Verdict banner ───────────────────────────────────────────────── */}
      <View style={[styles.verdictBanner, isClean ? styles.verdictClean : styles.verdictFlag]}>
        <MaterialIcons
          name={isClean ? 'check-circle' : 'warning'}
          size={s(28)}
          color={isClean ? '#34C759' : '#FF9500'}
        />
        <View style={styles.verdictText}>
          <Text style={[styles.verdictTitle, { color: isClean ? '#34C759' : '#FF9500' }]}>
            {headline}
          </Text>
          {!isClean && (
            <Text style={styles.verdictSub}>
              {analysis.severe_count > 0 ? `${analysis.severe_count} severe · ` : ''}
              {analysis.high_count > 0 ? `${analysis.high_count} high · ` : ''}
              {medium.length > 0 ? `${medium.length} moderate · ` : ''}
              {low.length > 0 ? `${low.length} low` : ''}
            </Text>
          )}
        </View>
      </View>

      {/* ── Aware's Take ─────────────────────────────────────────────────── */}
      <View style={styles.awaresTake}>
        <View style={styles.awaresTakeHeader}>
          <Feather name="zap" size={s(13)} color={Colors.accent} />
          <Text style={styles.awaresTakeLabel}>Aware's Take</Text>
        </View>
        <Text style={styles.awaresTakeText}>{awaresTake}</Text>
      </View>

      {/* ── For Your Skin (personalized) ─────────────────────────────────── */}
      {hasProfile && personalFlags.length > 0 && (
        <View style={styles.forYourSkin}>
          <View style={styles.forYourSkinHeader}>
            <Feather name="user" size={s(13)} color="#818CF8" />
            <Text style={styles.forYourSkinTitle}>
              For Your Skin
              {skinType ? ` (${skinType})` : ''}
              {skinConcerns && skinConcerns.length > 0
                ? ` · ${skinConcerns.slice(0, 2).join(', ')}`
                : ''}
            </Text>
          </View>
          {personalFlags.map((pf) => (
            <View key={pf.ingredient} style={styles.personalFlag}>
              <View
                style={[styles.personalFlagDot, { backgroundColor: SEVERITY_COLOR[pf.level] ?? Colors.textMuted }]}
              />
              <View style={styles.personalFlagBody}>
                <Text style={styles.personalFlagName}>{pf.ingredient}</Text>
                <Text style={styles.personalFlagReason}>{pf.reason}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Flagged ingredients list ──────────────────────────────────────── */}
      {flagged.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Flagged Ingredients</Text>
          <Text style={styles.sectionSub}>Tap each to see the reason and source.</Text>

          {severe.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: SEVERITY_COLOR.severe }]}>Severe</Text>
              {severe.map((item) => <IngredientCard key={item.ingredient} item={item} />)}
            </>
          )}
          {high.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: SEVERITY_COLOR.high }]}>High Concern</Text>
              {high.map((item) => <IngredientCard key={item.ingredient} item={item} />)}
            </>
          )}
          {medium.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: SEVERITY_COLOR.medium }]}>Moderate</Text>
              {medium.map((item) => <IngredientCard key={item.ingredient} item={item} />)}
            </>
          )}
          {low.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: SEVERITY_COLOR.low }]}>Low</Text>
              {low.map((item) => <IngredientCard key={item.ingredient} item={item} />)}
            </>
          )}
        </View>
      )}

      {/* ── Clean state ───────────────────────────────────────────────────── */}
      {isClean && (
        <View style={styles.cleanState}>
          <View style={styles.cleanStateRow}>
            <Feather name="check-circle" size={s(16)} color="#34C759" />
            <Text style={styles.cleanStateTitle}>What we checked</Text>
          </View>
          {[
            'EU Cosmetics Regulation (banned & restricted)',
            'IFRA fragrance allergen standards',
            'EWG Skin Deep hazard ratings',
            'Endocrine disruptor lists (parabens, phthalates)',
            'Common irritants for sensitive skin',
            'Comedogenic (pore-clogging) ingredients',
          ].map((item) => (
            <View key={item} style={styles.cleanCheckRow}>
              <View style={styles.cleanCheckDot} />
              <Text style={styles.cleanCheckText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Data attribution ──────────────────────────────────────────────── */}
      <View style={styles.attribution}>
        <Feather name="database" size={s(11)} color={Colors.textMuted} />
        <Text style={styles.attributionText}>
          Data sourced from EWG Skin Deep, IFRA Standards, EU CPNP, Paula's Choice &amp; INCIDecoder
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.canvasDark },
  content: { padding: s(16), gap: s(14), paddingBottom: s(48) },

  // Verdict
  verdictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    borderRadius: Radius.lg,
    padding: s(16),
    borderWidth: 1,
  },
  verdictClean: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderColor: 'rgba(52,199,89,0.25)',
  },
  verdictFlag: {
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderColor: 'rgba(255,149,0,0.25)',
  },
  verdictText: { flex: 1 },
  verdictTitle: { fontSize: s(16), fontFamily: Font.bold },
  verdictSub: { fontSize: s(11), color: Colors.textMuted, marginTop: s(3), fontFamily: Font.regular },

  // Aware's Take
  awaresTake: {
    backgroundColor: 'rgba(139,197,61,0.06)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139,197,61,0.20)',
    padding: s(14),
    gap: s(6),
  },
  awaresTakeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  awaresTakeLabel: {
    fontFamily: Font.bold,
    fontSize: s(11),
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  awaresTakeText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textOffWhite,
    lineHeight: s(20),
  },

  // For Your Skin
  forYourSkin: {
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.20)',
    padding: s(14),
    gap: s(10),
  },
  forYourSkinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(2),
  },
  forYourSkinTitle: {
    fontFamily: Font.bold,
    fontSize: s(13),
    color: '#A5B4FC',
  },
  personalFlag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(10),
  },
  personalFlagDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    marginTop: s(5),
    flexShrink: 0,
  },
  personalFlagBody: { flex: 1, gap: s(2) },
  personalFlagName: {
    fontFamily: Font.bold,
    fontSize: s(13),
    color: Colors.textOffWhite,
  },
  personalFlagReason: {
    fontFamily: Font.regular,
    fontSize: s(12),
    color: Colors.textMuted,
    lineHeight: s(17),
  },

  // Flagged list
  section: { gap: s(8) },
  sectionTitle: {
    fontSize: s(15),
    fontFamily: Font.bold,
    color: Colors.textOffWhite,
  },
  sectionSub: {
    fontSize: s(12),
    color: Colors.textMuted,
    fontFamily: Font.regular,
    marginBottom: s(2),
  },
  groupLabel: {
    fontSize: s(11),
    fontFamily: Font.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: s(4),
  },

  ingredientCard: {
    backgroundColor: Colors.canvasMid,
    borderRadius: Radius.lg,
    padding: s(12),
    borderWidth: 1,
    borderColor: Colors.border,
    gap: s(8),
  },
  ingredientHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: s(10) },
  severityDot: { width: s(10), height: s(10), borderRadius: s(5), marginTop: s(4) },
  ingredientMeta: { flex: 1, gap: s(6) },
  ingredientName: {
    fontSize: s(14),
    fontFamily: Font.bold,
    color: Colors.textOffWhite,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(4) },
  severityTag: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: s(6),
    paddingVertical: s(2),
  },
  severityTagText: { fontSize: s(10), fontFamily: Font.bold },
  concernTag: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.sm,
    paddingHorizontal: s(6),
    paddingVertical: s(2),
  },
  concernTagText: { fontSize: s(10), color: Colors.textMuted, fontFamily: Font.regular },
  ingredientBody: { gap: s(8), paddingTop: s(4) },
  ingredientReason: {
    fontSize: s(13),
    color: Colors.textMuted,
    fontFamily: Font.regular,
    lineHeight: s(19),
  },
  sourcesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(6) },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: 'rgba(99,102,241,0.10)',
    borderRadius: Radius.sm,
    paddingHorizontal: s(8),
    paddingVertical: s(4),
  },
  sourceText: { fontSize: s(10), color: Colors.accent, fontFamily: Font.regular },

  // Clean state
  cleanState: {
    backgroundColor: Colors.canvasMid,
    borderRadius: Radius.lg,
    padding: s(16),
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.2)',
    gap: s(10),
  },
  cleanStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginBottom: s(2),
  },
  cleanStateTitle: {
    fontFamily: Font.bold,
    fontSize: s(14),
    color: '#34C759',
  },
  cleanCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
  },
  cleanCheckDot: {
    width: s(5),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: 'rgba(52,199,89,0.6)',
    marginTop: s(6),
    flexShrink: 0,
  },
  cleanCheckText: {
    fontFamily: Font.regular,
    fontSize: s(13),
    color: Colors.textMuted,
    flex: 1,
    lineHeight: s(19),
  },

  // Attribution
  attribution: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(6),
    paddingTop: s(4),
  },
  attributionText: {
    fontSize: s(11),
    color: Colors.textMuted,
    fontFamily: Font.regular,
    lineHeight: s(16),
    flex: 1,
    opacity: 0.7,
  },
});
