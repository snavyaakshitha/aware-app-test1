#!/bin/bash
# Database Seeding Script
# Usage: ./run_seeds.sh [db_url]
# Example: ./run_seeds.sh "postgresql://user:password@localhost:5432/aware"

set -e

DB_URL="${1:-$DATABASE_URL}"

if [ -z "$DB_URL" ]; then
  echo "Error: Database URL not provided"
  echo "Usage: ./run_seeds.sh <database_url>"
  echo "Or set DATABASE_URL environment variable"
  exit 1
fi

SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SEED_DIR/seed.log"

echo "Starting database seeding..." | tee -a "$LOG_FILE"
echo "Timestamp: $(date)" | tee -a "$LOG_FILE"
echo "Database: $DB_URL" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

seed_count=0
success_count=0
failed_count=0

for sql_file in "$SEED_DIR"/*.sql; do
  if [ -f "$sql_file" ]; then
    filename=$(basename "$sql_file")
    seed_count=$((seed_count + 1))

    echo "Running: $filename"
    if psql "$DB_URL" -f "$sql_file" >> "$LOG_FILE" 2>&1; then
      echo "✓ $filename" | tee -a "$LOG_FILE"
      success_count=$((success_count + 1))
    else
      echo "✗ $filename" | tee -a "$LOG_FILE"
      failed_count=$((failed_count + 1))
    fi
  fi
done

echo "---" | tee -a "$LOG_FILE"
echo "Seeding complete!" | tee -a "$LOG_FILE"
echo "Total: $seed_count | Success: $success_count | Failed: $failed_count" | tee -a "$LOG_FILE"

if [ $failed_count -eq 0 ]; then
  echo "✓ All seeds applied successfully" | tee -a "$LOG_FILE"
  exit 0
else
  echo "✗ Some seeds failed. Check $LOG_FILE for details" | tee -a "$LOG_FILE"
  exit 1
fi
