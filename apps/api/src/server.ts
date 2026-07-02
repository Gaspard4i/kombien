import pg from 'pg';
import { loadConfig } from './config.ts';
import { buildApp } from './app.ts';
import { runMigrations } from './db/migrate.ts';

async function main(): Promise<void> {
  const config = loadConfig();

  // Migrations + seed conditionnel avant d'ouvrir le serveur.
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const report = await runMigrations(pool);
  await pool.end();
  console.log(
    `migrations: ${report.applied.length ? report.applied.join(', ') : 'aucune nouvelle'}` +
      `; seed: ${report.seeded ? 'appliqué' : 'ignoré (catégories déjà présentes)'}`,
  );

  const app = await buildApp(config);
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`kombien-api à l'écoute sur le port ${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
