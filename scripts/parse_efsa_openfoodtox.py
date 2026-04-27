#!/usr/bin/env python3
"""
Parse EFSA OpenFoodTox Excel files
Extracts substance characterization, reference values, and genotoxicity data
"""

import sys
import pandas as pd
from pathlib import Path

def parse_efsa_substances(excel_file):
    """Parse substance characterization sheet"""
    print(f"📖 Reading: {excel_file}")

    df = pd.read_excel(excel_file, sheet_name=0)

    print(f"\n📊 Substance Characterisation:")
    print(f"   Columns: {list(df.columns)}")
    print(f"   Rows: {len(df)}")

    # Show first few rows
    print(f"\n   First 5 entries:")
    print(df.head()[['SubstanceCode', 'SubstanceName'] if 'SubstanceCode' in df.columns else df.columns[:2]].to_string())

    return df

def parse_efsa_reference_values(excel_file):
    """Parse reference values sheet"""
    print(f"\n📖 Reading: {excel_file}")

    df = pd.read_excel(excel_file, sheet_name=0)

    print(f"\n📊 Reference Values:")
    print(f"   Columns: {list(df.columns)}")
    print(f"   Rows: {len(df)}")
    print(f"\n   First 5 entries:")
    print(df.head().to_string())

    return df

def parse_efsa_genotoxicity(excel_file):
    """Parse genotoxicity sheet"""
    print(f"\n📖 Reading: {excel_file}")

    df = pd.read_excel(excel_file, sheet_name=0)

    print(f"\n📊 Genotoxicity:")
    print(f"   Columns: {list(df.columns)}")
    print(f"   Rows: {len(df)}")
    print(f"\n   First 5 entries:")
    print(df.head().to_string())

    return df

def generate_ingredient_sql(substances_df):
    """Generate SQL for ingredients table from substance data"""

    sql = """-- EFSA OpenFoodTox Substance Import
-- Source: https://www.efsa.europa.eu/en/science/tools-and-resources/openfoodtox
-- Date: 2026-04-27

INSERT INTO public.ingredients
  (inci_name, description, ingredient_category, properties, created_at)
VALUES
"""

    rows = []
    processed = set()

    for idx, row in substances_df.iterrows():
        # Get the substance name (column name varies)
        substance_name = None
        for col in ['SubstanceName', 'Substance Name', 'Name', 'SubstanceName']:
            if col in row.index:
                substance_name = row[col]
                break

        if not substance_name or pd.isna(substance_name):
            continue

        substance_name = str(substance_name).strip()

        # Avoid duplicates
        if substance_name in processed:
            continue
        processed.add(substance_name)

        # Build properties JSON
        properties = {'efsa_openfoodtox': True}
        sql_row = f"  ('{substance_name.replace(\"'\", \"''\")}', 'EFSA OpenFoodTox substance', 'food_chemical', '{properties}'::jsonb, CURRENT_TIMESTAMP)"
        rows.append(sql_row)

    if rows:
        sql += ',\n'.join(rows[:100])  # Limit to 100 for preview
        sql += "\nON CONFLICT (inci_name) DO NOTHING;\n"
        return sql, len(rows)
    return None, 0

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python3 parse_efsa_openfoodtox.py <substance_file> <reference_file> <genotoxicity_file>")
        sys.exit(1)

    substance_file = sys.argv[1]
    reference_file = sys.argv[2]
    genotoxicity_file = sys.argv[3]

    for f in [substance_file, reference_file, genotoxicity_file]:
        if not Path(f).exists():
            print(f"❌ File not found: {f}")
            sys.exit(1)

    # Parse all files
    substances_df = parse_efsa_substances(substance_file)
    reference_df = parse_efsa_reference_values(reference_file)
    genotox_df = parse_efsa_genotoxicity(genotoxicity_file)

    # Generate SQL
    sql, count = generate_ingredient_sql(substances_df)

    if sql:
        output_file = "efsa_openfoodtox_import.sql"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(sql)

        print(f"\n✅ Generated: {output_file}")
        print(f"   Ready to insert {count} substances")
        print(f"\nSQL Preview:")
        lines = sql.split('\n')
        for line in lines[:10]:
            print(line)
    else:
        print("❌ No data to process")
