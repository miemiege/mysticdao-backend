#!/usr/bin/env tsx
/**
 * Database initialization script
 * Usage: npx tsx scripts/init-db.ts
 * Creates the data/ directory and runs initDatabase() to set up all tables.
 */
import { initDatabase } from '../src/lib/db/database.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || 'data/mysticdao.db';

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

// Initialize tables
initDatabase().then((db) => {
  db.close();
  console.log('✅ Database initialized at', DB_PATH);
  process.exit(0);
}).catch((err) => {
  console.error('❌ Database init failed:', err);
  process.exit(1);
});
