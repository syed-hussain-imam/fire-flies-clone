#!/bin/sh

# Set default environment variables
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export DATABASE_URL=${DATABASE_URL:-/app/data/sqlite.db}
export UPLOAD_DIR=${UPLOAD_DIR:-./uploads}

# Create database directory if it doesn't exist
mkdir -p "$(dirname "$DATABASE_URL")"

# Run database migration
echo "Running database migrations..."
node --input-type=module -e "
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database(process.env.DATABASE_URL);
const db = drizzle(sqlite);

try {
  migrate(db, { migrationsFolder: './drizzle' });
  console.log('Database migrations completed successfully!');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  sqlite.close();
}
"

# Start the application
echo "Starting the application..."
exec npm start 