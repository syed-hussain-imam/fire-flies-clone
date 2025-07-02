import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import 'dotenv/config';

console.log('Running migrations...');

migrate(db, { migrationsFolder: './drizzle' });

console.log('Migrations completed!'); 