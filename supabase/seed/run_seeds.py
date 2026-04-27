#!/usr/bin/env python3
"""
Database Seeding Script
Usage: python3 run_seeds.py [database_url]
Example: python3 run_seeds.py "postgresql://user:password@localhost:5432/aware"
"""

import sys
import os
import psycopg2
from pathlib import Path
from datetime import datetime

def run_seeds(db_url=None):
    """Run all SQL seed files in order"""
    if not db_url:
        db_url = os.getenv('DATABASE_URL')

    if not db_url:
        print("Error: Database URL not provided")
        print("Usage: python3 run_seeds.py <database_url>")
        print("Or set DATABASE_URL environment variable")
        sys.exit(1)

    seed_dir = Path(__file__).parent
    log_file = seed_dir / 'seed.log'

    with open(log_file, 'a') as log:
        log.write(f"\nStarting database seeding...\n")
        log.write(f"Timestamp: {datetime.now().isoformat()}\n")
        log.write(f"Database: {db_url}\n")
        log.write(f"---\n")

    print(f"Starting database seeding...")
    print(f"Database: {db_url}")

    # Get all SQL files sorted
    sql_files = sorted([f for f in seed_dir.glob('*.sql')])

    success_count = 0
    failed_count = 0

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()

        for sql_file in sql_files:
            filename = sql_file.name
            print(f"Running: {filename}")

            try:
                with open(sql_file, 'r', encoding='utf-8') as f:
                    sql_content = f.read()

                cursor.execute(sql_content)
                print(f"✓ {filename}")

                with open(log_file, 'a') as log:
                    log.write(f"✓ {filename}\n")

                success_count += 1
            except Exception as e:
                print(f"✗ {filename}: {str(e)}")

                with open(log_file, 'a') as log:
                    log.write(f"✗ {filename}: {str(e)}\n")

                failed_count += 1

        cursor.close()
        conn.close()

        with open(log_file, 'a') as log:
            log.write(f"---\n")
            log.write(f"Seeding complete!\n")
            log.write(f"Total: {len(sql_files)} | Success: {success_count} | Failed: {failed_count}\n")

        print(f"\n---")
        print(f"Seeding complete!")
        print(f"Total: {len(sql_files)} | Success: {success_count} | Failed: {failed_count}")

        if failed_count == 0:
            print("✓ All seeds applied successfully")
            return 0
        else:
            print(f"✗ Some seeds failed. Check {log_file} for details")
            return 1

    except psycopg2.OperationalError as e:
        print(f"Error: Failed to connect to database: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    db_url = sys.argv[1] if len(sys.argv) > 1 else None
    exit_code = run_seeds(db_url)
    sys.exit(exit_code)
