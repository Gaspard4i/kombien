// Runner de migrations idempotent + seed conditionnel.
//
// Comportement (documenté aussi dans README) :
//   1. Crée la table schema_migrations si absente.
//   2. Liste db/migrations/*.sql triés par nom, applique dans l'ordre ceux qui
//      ne sont pas déjà dans schema_migrations. Chaque migration + son insertion
//      dans schema_migrations sont dans une transaction (atomique).
//   3. Applique db/seed/0001_seed.sql UNIQUEMENT si la table categories est vide
//      (seed non versionné mais conditionnel : ne rejoue pas de données par-dessus
//      un jeu existant, permet un premier amorçage).

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
// dist/db/migrate.js ou src/db/migrate.ts -> remonter à la racine du repo (../../../..).
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'db', 'migrations');
const SEED_FILE = join(REPO_ROOT, 'db', 'seed', '0001_seed.sql');

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
}

async function applyMigration(pool: Pool, name: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedIfEmpty(pool: Pool): Promise<boolean> {
  // Exclut la catégorie is_calibration (seedée par 0005_calibration.sql) du test
  // de vacuité : sinon, sur une DB neuve, cette migration remplit `categories`
  // avant même que ce test ne s'exécute et fait croire à tort que le jeu de
  // données principal est déjà présent (seed jamais appliqué).
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::int AS count FROM categories WHERE is_calibration = false"
  );
  const isEmpty = rows[0]?.count === undefined ? true : Number(rows[0].count) === 0;
  if (!isEmpty) return false;
  const seedSql = await readFile(SEED_FILE, 'utf8');
  await pool.query(seedSql);
  return true;
}

export interface MigrationReport {
  applied: string[];
  seeded: boolean;
}

export async function runMigrations(pool: Pool): Promise<MigrationReport> {
  await ensureMigrationsTable(pool);
  const done = await appliedMigrations(pool);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await applyMigration(pool, file, sql);
    applied.push(file);
  }

  const seeded = await seedIfEmpty(pool);
  return { applied, seeded };
}
