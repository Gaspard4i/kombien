// Configuration via variables d'environnement. Aucun secret n'a de valeur par
// défaut : ADMIN_SECRET absent => les routes admin renvoient 401 (voir plugin admin).

export interface AppConfig {
  port: number;
  databaseUrl: string;
  adminSecret: string | undefined;
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
    isDev: env.NODE_ENV !== 'production',
  };
}
