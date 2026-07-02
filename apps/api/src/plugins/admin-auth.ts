// Vérification du header x-admin-secret à temps constant.
// Si ADMIN_SECRET n'est pas configuré : accès admin refusé (401), jamais ouvert.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual exige des longueurs égales ; on compare d'abord un buffer de
  // même longueur pour ne pas révéler la longueur via une exception.
  if (bufA.length !== bufB.length) {
    // Comparaison factice pour garder un temps ~constant, résultat toujours faux.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function makeAdminGuard(adminSecret: string | undefined) {
  return async function adminGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const provided = request.headers['x-admin-secret'];
    if (!adminSecret || typeof provided !== 'string' || !constantTimeEquals(provided, adminSecret)) {
      await reply.code(401).send({ error: 'unauthorized' });
    }
  };
}
