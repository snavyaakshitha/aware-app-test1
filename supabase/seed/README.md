# Database Seeding

This directory contains seed data for initializing the Aware database with reference ingredients, product categories, and regulatory information.

## Files

- **01_product_categories.sql**: Core product category lookups (Skincare, Haircare, Food, Household, etc.)
- **02_basic_ingredients.sql**: Common ingredients found in consumer products
- **03_skincare_ingredient_rules.sql**: Skincare-specific ingredient concerns and health implications
- **04_food_additive_rules.sql**: Food additive regulatory information and health effects

## Importing External Data

The `/scripts/` directory contains parsers for importing data from external sources:

### Health Canada Cosmetic Ingredient Hotlist

Parse prohibited and restricted cosmetic ingredients from Health Canada:

```bash
python3 scripts/parse_health_canada.py <path_to_html_file>
```

This generates `<filename>_import.sql` with banned ingredient data for the `banned_ingredients_by_country` table.

### EFSA OpenFoodTox Database

Parse EFSA OpenFoodTox Excel files for food additive information:

```bash
python3 scripts/parse_efsa_openfoodtox.py \
  <substance_file.xlsx> \
  <reference_file.xlsx> \
  <genotoxicity_file.xlsx>
```

This generates `efsa_openfoodtox_import.sql` with substance data for the `ingredients` and food safety tables.

**Note:** EFSA files are available at: https://www.efsa.europa.eu/en/science/tools-and-resources/openfoodtox

## Running Seed Data

### Option 1: Via Supabase CLI (Recommended)

After running migrations (`supabase db push`), seed the database:

```bash
# Seed all data
for file in supabase/seed/*.sql; do
  psql -h $SUPABASE_HOST -d $SUPABASE_DB -U postgres -f "$file"
done
```

Or use Supabase's web dashboard to manually run each SQL file.

### Option 2: Via Direct SQL

Execute each seed file in order through your database client or Supabase dashboard:

1. `01_product_categories.sql`
2. `02_basic_ingredients.sql`
3. `03_skincare_ingredient_rules.sql`
4. `04_food_additive_rules.sql`

Then import any external data:

5. Generated `*_import.sql` files (Health Canada, EFSA, etc.)

## Data Strategy

The seed data includes:

- **Basic Ingredients**: ~25 common cosmetic and food ingredients
- **Product Categories**: 10 primary product types
- **Skincare Rules**: Health concerns and efficacy data
- **Food Additives**: Regulatory status by region

## Extending Seed Data

To add more data:

1. Create a new `.sql` file in `supabase/seed/` with a sequential number prefix
2. Use `ON CONFLICT ... DO NOTHING` to handle duplicates safely
3. Include timestamp and source information
4. Document the file in this README

## References

- EFSA OpenFoodTox: https://www.efsa.europa.eu/en/science/tools-and-resources/openfoodtox
- Health Canada Cosmetics: https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics
- EWG Skin Deep Database: https://www.ewg.org/skindeep
