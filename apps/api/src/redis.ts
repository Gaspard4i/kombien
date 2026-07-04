// Connexion Redis pour le multi-écrans temps réel (Lot 9 : rooms + classement live).
// Optionnelle au démarrage : le pass-and-play ne dépend pas de Redis, donc une
// erreur de connexion est loggée mais ne fait pas planter l'API (voir buildApp).
// Les endpoints rooms/WS qui consomment ce client viendront dans un lot suivant.

import { createClient, type RedisClientType } from 'redis';

export function createRedisClient(redisUrl: string): RedisClientType {
  const client: RedisClientType = createClient({ url: redisUrl });

  client.on('error', (err) => {
    console.error('[redis] erreur de connexion', err);
  });

  return client;
}

export async function connectRedis(client: RedisClientType): Promise<void> {
  await client.connect();
}
