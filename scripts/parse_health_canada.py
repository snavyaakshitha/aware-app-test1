#!/usr/bin/env python3
"""
Parse Health Canada Cosmetic Ingredient Hotlist HTML
Extracts prohibited and restricted ingredients into SQL INSERT statements
"""

import sys
import re
from pathlib import Path
from bs4 import BeautifulSoup

def parse_health_canada_html(html_file):
    """Parse Health Canada HTML and extract prohibited/restricted ingredients"""

    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    results = {
        'prohibited': [],
        'restricted': []
    }

    # Find tables in the HTML
    tables = soup.find_all('table')

    for table in tables:
        rows = table.find_all('tr')

        # Determine if this is prohibited or restricted
        # Usually identified by preceding headers or table titles
        table_text = table.get_text().lower()
        is_prohibited = 'prohibited' in table_text
        is_restricted = 'restricted' in table_text

        for row in rows[1:]:  # Skip header row
            cols = row.find_all('td')
            if len(cols) < 2:
                continue

            ingredient_name = cols[0].get_text().strip()
            reason = cols[1].get_text().strip() if len(cols) > 1 else ''

            if not ingredient_name:
                continue

            entry = {
                'ingredient_name': ingredient_name,
                'ban_status': 'banned' if is_prohibited else 'restricted',
                'reason': reason,
                'country_code': 'CA'
            }

            if is_prohibited:
                results['prohibited'].append(entry)
            elif is_restricted:
                results['restricted'].append(entry)

    return results

def generate_sql(parsed_data):
    """Generate SQL INSERT statements for banned_ingredients_by_country"""

    all_entries = parsed_data['prohibited'] + parsed_data['restricted']

    sql = """-- Health Canada Cosmetic Ingredient Hotlist Import
-- Source: https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics/cosmetic-ingredient-hotlist-prohibited-restricted-ingredients.html
-- Date: 2026-04-27

INSERT INTO public.banned_ingredients_by_country
  (ingredient_name, country_code, ban_status, reason, regulatory_body_id, last_reviewed)
VALUES
"""

    rows = []
    for entry in all_entries:
        # Escape single quotes
        ingredient = entry['ingredient_name'].replace("'", "''")
        reason = entry['reason'].replace("'", "''")

        row = f"  ('{ingredient}', '{entry['country_code']}', '{entry['ban_status']}', '{reason}', 5, CURRENT_DATE)"
        rows.append(row)

    sql += ',\n'.join(rows)
    sql += "\nON CONFLICT (country_code, ingredient_name, ban_status) DO NOTHING;\n"

    return sql

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 parse_health_canada.py <html_file>")
        sys.exit(1)

    html_file = sys.argv[1]

    if not Path(html_file).exists():
        print(f"Error: File not found: {html_file}")
        sys.exit(1)

    print(f"📖 Parsing: {html_file}")
    data = parse_health_canada_html(html_file)

    print(f"✅ Found {len(data['prohibited'])} prohibited ingredients")
    print(f"✅ Found {len(data['restricted'])} restricted ingredients")

    sql = generate_sql(data)

    output_file = Path(html_file).stem + '_import.sql'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(sql)

    print(f"\n✅ Generated: {output_file}")
    print(f"\nSQL Preview (first 3 rows):")
    lines = sql.split('\n')
    for line in lines[:15]:
        print(line)
