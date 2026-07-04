// Configuration via variables d'environnement. Aucun secret n'a de valeur par
// défaut : ADMIN_SECRET absent => les routes admin renvoient 401 (voir plugin admin).

export interface AppConfig {
  port: number;
  databaseUrl: string;
  adminSecret: string | undefined;
  // Redis alimente le multi-écrans temps réel (rooms, Lot 9). Optionnel : le
  // pass-and-play ne dépend pas de Redis, donc un défaut dev suffit (pas de
  // throw si absent, contrairement à DATABASE_URL).
  redisUrl: string;
  // Base du front, utilisée pour construire le lien encodé dans le QR de room
  // (Lot 9) — jamais pour CORS (cf. CORS_ORIGIN, distinct).
  webBaseUrl: string;
  isDev: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL est requis');
  }
  return {
    port: env.PORT ? Number(env.PORT) : 3000,
    databaseUrl,
    adminSecret: env.ADMIN_SECRET, // pas de fallback : secret jamais en dur
    redisUrl: env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    webBaseUrl: env.WEB_BASE_URL ?? 'http://localhost:5173',
    isDev: env.NODE_ENV !== 'production',
  };
}
