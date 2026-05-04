/**
 * Unit tests for shared/awaretake.ts
 *
 * Run: npx jest shared/__tests__/awaretake.test.ts
 *
 * All functions are pure — no mocks needed.
 * Type-only imports in awaretake.ts mean openFoodFacts.ts and scoring.ts
 * are never loaded at runtime during these tests.
 */

import {
  fmtNum,
  inferNovaGroup,
  deriveOverallVerdict,
  buildNutrientRows,
  generateHeadline,
  generateAwareTake,
} from '../awaretake';
import type { OverallVerdict, NutrientRow } from '../awaretake';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeOff(overrides: {
  novaGroup?: number | null;
  ingredientsText?: string;
  nutriscoreGrade?: string | null;
  nutriments?: Partial<{
    energy_kcal_100g: number | null;
    fat_100g: number | null;
    saturated_fat_100g: number | null;
    carbohydrates_100g: number | null;
    sugars_100g: number | null;
    fiber_100g: number | null;
    proteins_100g: number | null;
    sodium_100g: number | null;
    salt_100g: number | null;
    energy_kj_100g: number | null;
  }> | null;
} = {}) {
  return {
    code: '1234567890',
    productName: 'Test Product',
    brand: 'Test Brand',
    imageUrl: null,
    ingredientsText: overrides.ingredientsText ?? '',
    allergensTags: [],
    tracesTags: [],
    nutriscoreGrade: overrides.nutriscoreGrade ?? null,
    novaGroup: overrides.novaGroup !== undefined ? overrides.novaGroup : null,
    ingredientsAnalysisTags: [],
    nutriments: overrides.nutriments !== undefined
      ? overrides.nutriments === null ? null : {
          energy_kj_100g: null,
          energy_kcal_100g: null,
          fat_100g: null,
          saturated_fat_100g: null,
          carbohydrates_100g: null,
          sugars_100g: null,
          fiber_100g: null,
          proteins_100g: null,
          sodium_100g: null,
          salt_100g: null,
          ...overrides.nutriments,
        }
      : null,
  };
}

function makeSafety(overrides: {
  verdict?: 'safe' | 'check' | 'avoid';
  allergenConflicts?: string[];
  avoidList?: { ingredient: string; reason: string | null }[];
  cautionList?: { ingredient: string; reason: string | null }[];
  beneficialList?: { ingredient: string; reason: string | null }[];
} = {}) {
  return {
    verdict: overrides.verdict ?? 'safe',
    allergenConflicts: overrides.allergenConflicts ?? [],
    avoidList: overrides.avoidList ?? [],
    cautionList: overrides.cautionList ?? [],
    beneficialList: overrides.beneficialList ?? [],
  };
}

function makeAdditives(overrides: {
  severe?: { ingredient: string; severity: 'severe'; reason: string | null; source_url?: string | null }[];
  high?: { ingredient: string; severity: 'high'; reason: string | null; source_url?: string | null }[];
  medium?: { ingredient: string; severity: 'medium'; reason: string | null; source_url?: string | null }[];
  low?: { ingredient: string; severity: 'low'; reason: string | null; source_url?: string | null }[];
  total?: number;
} = {}) {
  const severe = overrides.severe ?? [];
  const high = overrides.high ?? [];
  const medium = overrides.medium ?? [];
  const low = overrides.low ?? [];
  return {
    severe,
    high,
    medium,
    low,
    total: overrides.total ?? severe.length + high.length + medium.length + low.length,
  };
}

function makeBanned(count = 1) {
  return Array.from({ length: count }, (_, i) => ({
    ingredient: `ingredient_${i}`,
    substanceName: `BannedSubstance${i}`,
    jurisdictions: ['EU', 'UK'],
    regulatoryBody: 'EFSA',
    reason: 'Carcinogenic at high doses.',
    sourceUrl: null,
  }));
}

function makeGlobalBanEntry(overrides: {
  ingredient_name?: string;
  country_code?: string;
  ban_status?: string;
} = {}) {
  return {
    ingredient_name: overrides.ingredient_name ?? 'test-ingredient',
    country_code: overrides.country_code ?? 'EU',
    ban_status: overrides.ban_status ?? 'banned',
    reason: null,
    regulation_link: null,
    regulatory_body_code: null,
    category_restricted_to: null,
    notes: null,
  };
}

function makeGlobalBans(overrides: {
  bannedIngredients?: ReturnType<typeof makeGlobalBanEntry>[];
  hasSevereBan?: boolean;
} = {}) {
  const bannedIngredients = overrides.bannedIngredients ?? [];
  return {
    bannedIngredients,
    hasSevereBan: overrides.hasSevereBan ?? bannedIngredients.some((b) => b.ban_status === 'banned'),
  };
}

function makeAnalysis(overrides: {
  safety?: ReturnType<typeof makeSafety>;
  additives?: ReturnType<typeof makeAdditives>;
  bannedSubstances?: ReturnType<typeof makeBanned>;
  globalBans?: ReturnType<typeof makeGlobalBans>;
} = {}) {
  return {
    safety: overrides.safety ?? makeSafety(),
    additives: overrides.additives ?? makeAdditives(),
    bannedSubstances: overrides.bannedSubstances ?? [],
    globalBans: overrides.globalBans ?? makeGlobalBans(),
    conflicts: { conflicts: [], hasSevereConflict: false },
    allergenMatches: [],
  };
}

// ─── fmtNum ───────────────────────────────────────────────────────────────────

describe('fmtNum', () => {
  it('returns "0" for zero', () => {
    expect(fmtNum(0)).toBe('0');
  });

  it('returns integer as string without decimal', () => {
    expect(fmtNum(5)).toBe('5');
    expect(fmtNum(100)).toBe('100');
  });

  it('rounds float to 1 decimal place', () => {
    expect(fmtNum(51.9480519)).toBe('51.9');   // Math.round(519.480…)/10 = 51.9
    expect(fmtNum(51.94)).toBe('51.9');
    expect(fmtNum(22.549)).toBe('22.5');
    expect(fmtNum(22.55)).toBe('22.6');
  });

  it('keeps exact 1dp float as-is', () => {
    expect(fmtNum(3.5)).toBe('3.5');
    expect(fmtNum(10.1)).toBe('10.1');
  });

  it('handles negative numbers', () => {
    expect(fmtNum(-5)).toBe('-5');
    expect(fmtNum(-3.75)).toBe('-3.7');   // JS Math.round(-37.5) = -37 (rounds toward +∞)
  });
});

// ─── inferNovaGroup ───────────────────────────────────────────────────────────

describe('inferNovaGroup', () => {
  it('returns existing novaGroup when not null', () => {
    expect(inferNovaGroup(makeOff({ novaGroup: 4 }))).toBe(4);
    expect(inferNovaGroup(makeOff({ novaGroup: 2 }))).toBe(2);
  });

  it('returns null when ingredientsText is empty (unknown — not assumed whole food)', () => {
    expect(inferNovaGroup(makeOff({ novaGroup: null, ingredientsText: '' }))).toBeNull();
    expect(inferNovaGroup(makeOff({ novaGroup: null, ingredientsText: '   ' }))).toBeNull();
  });

  it('returns 1 for single short ingredient', () => {
    expect(inferNovaGroup(makeOff({ novaGroup: null, ingredientsText: 'Apple' }))).toBe(1);
    expect(inferNovaGroup(makeOff({ novaGroup: null, ingredientsText: 'Whole milk' }))).toBe(1);
  });

  it('returns null for multi-ingredient products without database novaGroup', () => {
    const text = 'Sugar, water, caramel color, phosphoric acid, natural flavors';
    expect(inferNovaGroup(makeOff({ novaGroup: null, ingredientsText: text }))).toBeNull();
  });

  it('returns 0 when novaGroup is 0 (explicit)', () => {
    expect(inferNovaGroup(makeOff({ novaGroup: 0 }))).toBe(0);
  });
});

// ─── deriveOverallVerdict ─────────────────────────────────────────────────────

describe('deriveOverallVerdict', () => {
  const emptyAdditives = makeAdditives();
  const emptyBanned: ReturnType<typeof makeBanned> = [];
  const emptyGlobalBans = makeGlobalBans();

  it('returns "red" when allergen conflict present', () => {
    const safety = makeSafety({ allergenConflicts: ['gluten'] });
    expect(deriveOverallVerdict(safety, emptyAdditives, emptyBanned, emptyGlobalBans, null, null)).toBe('red');
  });

  it('returns "red" when banned substance present', () => {
    const safety = makeSafety();
    expect(deriveOverallVerdict(safety, emptyAdditives, makeBanned(1), emptyGlobalBans, null, null)).toBe('red');
  });

  it('returns "red" when avoid list is non-empty', () => {
    const safety = makeSafety({ avoidList: [{ ingredient: 'aspartame', reason: 'test' }] });
    expect(deriveOverallVerdict(safety, emptyAdditives, emptyBanned, emptyGlobalBans, null, null)).toBe('red');
  });

  it('returns "red" when severe additive present', () => {
    const additives = makeAdditives({
      severe: [{ ingredient: 'potassium bromate', severity: 'severe', reason: 'carcinogen' }],
    });
    expect(deriveOverallVerdict(makeSafety(), additives, emptyBanned, emptyGlobalBans, null, null)).toBe('red');
  });

  it('returns "red" when globalBans hasSevereBan', () => {
    const globalBans = makeGlobalBans({
      bannedIngredients: [makeGlobalBanEntry({ ingredient_name: 'bvo', country_code: 'US', ban_status: 'banned' })],
      hasSevereBan: true,
    });
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, globalBans, null, null)).toBe('red');
  });

  it('returns "yellow" when caution list non-empty', () => {
    const safety = makeSafety({ cautionList: [{ ingredient: 'msg', reason: 'headache risk' }] });
    expect(deriveOverallVerdict(safety, emptyAdditives, emptyBanned, emptyGlobalBans, null, null)).toBe('yellow');
  });

  it('returns "yellow" when high-concern additive present', () => {
    const additives = makeAdditives({
      high: [{ ingredient: 'red 40', severity: 'high', reason: 'hyperactivity' }],
    });
    expect(deriveOverallVerdict(makeSafety(), additives, emptyBanned, emptyGlobalBans, null, null)).toBe('yellow');
  });

  it('returns "yellow" when globalBans has restricted ingredient', () => {
    const globalBans = makeGlobalBans({
      bannedIngredients: [makeGlobalBanEntry({ ingredient_name: 'red 40', country_code: 'EU', ban_status: 'restricted' })],
      hasSevereBan: false,
    });
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, globalBans, null, null)).toBe('yellow');
  });

  it('returns "green" when beneficial list non-empty', () => {
    const safety = makeSafety({ beneficialList: [{ ingredient: 'omega-3', reason: 'heart health' }] });
    expect(deriveOverallVerdict(safety, emptyAdditives, emptyBanned, emptyGlobalBans, null, null)).toBe('green');
  });

  it('returns "green" for nova 1 products', () => {
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, emptyGlobalBans, 1, null)).toBe('green');
  });

  it('returns "green" for nutriscore A', () => {
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, emptyGlobalBans, null, 'a')).toBe('green');
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, emptyGlobalBans, null, 'A')).toBe('green');
  });

  it('returns "green" for nutriscore B', () => {
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, emptyGlobalBans, null, 'b')).toBe('green');
  });

  it('returns "green" when nothing positive or negative', () => {
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, emptyGlobalBans, null, null)).toBe('green');
    expect(deriveOverallVerdict(makeSafety(), emptyAdditives, emptyBanned, emptyGlobalBans, 3, 'c')).toBe('green');
  });

  it('red beats yellow beats green (priority order)', () => {
    const safety = makeSafety({
      allergenConflicts: ['peanuts'],
      beneficialList: [{ ingredient: 'omega-3', reason: null }],
    });
    expect(deriveOverallVerdict(safety, emptyAdditives, emptyBanned, emptyGlobalBans, 1, 'a')).toBe('red');
  });
});

// ─── buildNutrientRows ────────────────────────────────────────────────────────

describe('buildNutrientRows', () => {
  const nullNutriments = {
    energy_kj_100g: null,
    energy_kcal_100g: null,
    fat_100g: null,
    saturated_fat_100g: null,
    carbohydrates_100g: null,
    sugars_100g: null,
    fiber_100g: null,
    proteins_100g: null,
    sodium_100g: null,
    salt_100g: null,
  };

  it('returns 8 rows', () => {
    const rows = buildNutrientRows(nullNutriments, null);
    expect(rows).toHaveLength(8);
  });

  it('returns "Not available" and alert "none" for all-null nutriments', () => {
    const rows = buildNutrientRows(nullNutriments, null);
    for (const row of rows) {
      expect(row.what).toBe('Not available');
      expect(row.alert).toBe('none');
    }
  });

  it('flags high sugar (>=22.5g) as red alert for non-whole-food', () => {
    const nm = { ...nullNutriments, sugars_100g: 30 };
    const rows = buildNutrientRows(nm, null);
    const sugar = rows.find((r) => r.label === 'Sugar')!;
    expect(sugar.alert).toBe('red');
    expect(sugar.what.toLowerCase()).toContain('high');
  });

  it('does not flag sugar as red for nova 1 whole food', () => {
    const nm = { ...nullNutriments, sugars_100g: 30 };
    const rows = buildNutrientRows(nm, 1);
    const sugar = rows.find((r) => r.label === 'Sugar')!;
    expect(sugar.alert).toBe('none');
    expect(sugar.what).toContain('naturally occurring');
  });

  it('derives salt from sodium when salt_100g is null', () => {
    const nm = { ...nullNutriments, sodium_100g: 1.0, salt_100g: null };
    const rows = buildNutrientRows(nm, null);
    const salt = rows.find((r) => r.label === 'Salt')!;
    expect(salt.value).toBeCloseTo(2.5);  // 1.0 * 2.5
    expect(salt.alert).toBe('red');       // 2.5 > 1.5
  });

  it('prefers salt_100g over derived sodium value', () => {
    const nm = { ...nullNutriments, sodium_100g: 1.0, salt_100g: 0.3 };
    const rows = buildNutrientRows(nm, null);
    const salt = rows.find((r) => r.label === 'Salt')!;
    expect(salt.value).toBe(0.3);
    expect(salt.alert).toBe('green');
  });

  it('flags high protein as green alert', () => {
    const nm = { ...nullNutriments, proteins_100g: 20 };
    const rows = buildNutrientRows(nm, null);
    const protein = rows.find((r) => r.label === 'Protein')!;
    expect(protein.alert).toBe('green');
  });

  it('flags high fibre as green alert', () => {
    const nm = { ...nullNutriments, fiber_100g: 6 };
    const rows = buildNutrientRows(nm, null);
    const fibre = rows.find((r) => r.label === 'Fibre')!;
    expect(fibre.alert).toBe('green');
  });

  it('flags high saturated fat as red', () => {
    const nm = { ...nullNutriments, saturated_fat_100g: 15 };
    const rows = buildNutrientRows(nm, null);
    const satFat = rows.find((r) => r.label === 'Saturated Fat')!;
    expect(satFat.alert).toBe('red');
  });

  it('does not duplicate salt calculation (value === what value)', () => {
    // Ensure the salt value in `value` field equals the value used in `what` and `alert`
    const nm = { ...nullNutriments, sodium_100g: 0.5, salt_100g: null };
    const rows = buildNutrientRows(nm, null);
    const salt = rows.find((r) => r.label === 'Salt')!;
    const expectedSalt = 0.5 * 2.5; // 1.25
    expect(salt.value).toBeCloseTo(expectedSalt);
    expect(salt.alert).toBe('amber');  // 1.25 is between 0.6 and 1.5
  });
});

// ─── generateHeadline ────────────────────────────────────────────────────────

describe('generateHeadline', () => {
  it('returns allergen conflict headline when allergens present', () => {
    const off = makeOff();
    const analysis = makeAnalysis({
      safety: makeSafety({ allergenConflicts: ['gluten', 'dairy'] }),
    });
    const result = generateHeadline(off, analysis, null);
    expect(result).toContain('Contains gluten and dairy');
    expect(result).toContain('conflicts with your profile');
  });

  it('returns banned substance headline', () => {
    const off = makeOff();
    const analysis = makeAnalysis({
      bannedSubstances: [makeBanned(1)[0]],
    });
    const result = generateHeadline(off, analysis, null);
    expect(result).toContain('banned in EU, UK');
  });

  it('returns severe additive headline', () => {
    const off = makeOff();
    const analysis = makeAnalysis({
      additives: makeAdditives({
        severe: [{ ingredient: 'potassium bromate', severity: 'severe', reason: 'carcinogen' }],
      }),
    });
    const result = generateHeadline(off, analysis, null);
    expect(result).toContain('potassium bromate');
    expect(result).toContain('severe-concern additive');
  });

  it('returns sugar headline for very high sugar non-whole-food', () => {
    const off = makeOff({ nutriments: { sugars_100g: 45 } });
    const result = generateHeadline(off, makeAnalysis(), null);
    expect(result).toContain('45g sugar');
    expect(result).toContain('teaspoons');
    expect(result).toContain('WHO');
  });

  it('does NOT flag sugar for NOVA 1 whole food', () => {
    const off = makeOff({ nutriments: { sugars_100g: 45 }, novaGroup: 1 });
    const result = generateHeadline(off, makeAnalysis(), 1);
    expect(result).not.toContain('sugar per 100g');
  });

  it('returns whole food headline for nova 1 with few ingredients', () => {
    const off = makeOff({
      novaGroup: 1,
      ingredientsText: 'Apple, cinnamon',
    });
    const result = generateHeadline(off, makeAnalysis(), 1);
    expect(result).toContain('2 ingredients');
    expect(result).toContain('No additives');
  });

  it('returns ultra-processed headline for NOVA 4 with poor nutriscore', () => {
    const off = makeOff({ nutriscoreGrade: 'e' });
    const result = generateHeadline(off, makeAnalysis(), 4);
    expect(result).toContain('Ultra-processed');
    expect(result).toContain('poor nutrition');
  });

  it('returns nutriscore E fallback when no other signal', () => {
    const off = makeOff({ nutriscoreGrade: 'e' });
    const result = generateHeadline(off, null, null);
    expect(result).toBe('Very poor nutritional quality per Nutri-Score.');
  });

  it('returns nutriscore A fallback', () => {
    const off = makeOff({ nutriscoreGrade: 'a' });
    const result = generateHeadline(off, null, null);
    expect(result).toBe('Excellent nutritional quality per Nutri-Score.');
  });

  it('returns generic fallback when nothing to say', () => {
    const off = makeOff();
    const result = generateHeadline(off, null, null);
    expect(result).toBe('Check the full analysis below.');
  });

  it('returns protein headline for high-protein, low-sugar product', () => {
    const off = makeOff({ nutriments: { proteins_100g: 25, sugars_100g: 2 } });
    const result = generateHeadline(off, makeAnalysis(), 3);
    expect(result).toContain('25g protein');
    expect(result).toContain('solid macronutrient');
  });
});

// ─── generateAwareTake ───────────────────────────────────────────────────────

describe('generateAwareTake', () => {
  it('leads with banned substance sentence', () => {
    const off = makeOff();
    const analysis = makeAnalysis({ bannedSubstances: makeBanned(1) });
    const result = generateAwareTake(off, analysis, [], null);
    expect(result).toContain('BannedSubstance0');
    expect(result).toContain('banned in EU, UK');
  });

  it('leads with allergen conflict sentence', () => {
    const off = makeOff();
    const analysis = makeAnalysis({
      safety: makeSafety({ allergenConflicts: ['gluten', 'dairy'] }),
    });
    const result = generateAwareTake(off, analysis, [], null);
    expect(result).toContain('gluten and dairy');
    expect(result).toContain('allergen profile');
  });

  it('mentions whole food for nova 1', () => {
    const off = makeOff({ novaGroup: 1 });
    const result = generateAwareTake(off, makeAnalysis(), [], 1);
    expect(result).toContain('whole food');
    expect(result).toContain('no industrial processing');
  });

  it('mentions ultra-processed for nova 4', () => {
    const off = makeOff();
    const result = generateAwareTake(off, makeAnalysis(), [], 4);
    expect(result).toContain('ultra-processed (NOVA 4)');
  });

  it('includes diabetes personalised sentence for high sugar', () => {
    const off = makeOff({ nutriments: { sugars_100g: 35 } });
    const result = generateAwareTake(off, makeAnalysis(), ['diabetes_t2'], 3);
    expect(result).toContain('diabetes');
    expect(result).toContain('sugar level');
  });

  it('includes PCOS personalised sentence', () => {
    const off = makeOff({ nutriments: { sugars_100g: 20 } });
    const result = generateAwareTake(off, makeAnalysis(), ['pcos'], 3);
    expect(result).toContain('PCOS');
    expect(result).toContain('insulin resistance');
  });

  it('returns max 3 sentences', () => {
    const off = makeOff({ nutriments: { sugars_100g: 50 } });
    const analysis = makeAnalysis({
      safety: makeSafety({
        cautionList: [{ ingredient: 'msg', reason: null }],
        beneficialList: [{ ingredient: 'omega-3', reason: null }],
      }),
      additives: makeAdditives({
        high: [{ ingredient: 'red 40', severity: 'high', reason: null }],
      }),
    });
    const result = generateAwareTake(off, analysis, ['diabetes_t2'], 3);
    const sentences = result.split('. ').filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(3);
  });

  it('falls back to "No major concerns" for nutriscore A with no issues', () => {
    const off = makeOff({ nutriscoreGrade: 'a' });
    const result = generateAwareTake(off, null, [], null);
    expect(result).toContain('No major concerns');
    expect(result).toContain('solid everyday choice');
  });

  it('uses whole food fallback for nova 1 with no analysis', () => {
    const result = generateAwareTake(makeOff(), null, [], 1);
    expect(result.toLowerCase()).toContain('whole food');
  });

  it('does NOT apply sugar flags to NOVA 1 products', () => {
    const off = makeOff({ nutriments: { sugars_100g: 50 } });
    const result = generateAwareTake(off, makeAnalysis(), [], 1);
    expect(result).not.toContain('high-sugar');
  });
});
