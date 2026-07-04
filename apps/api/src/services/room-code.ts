// Code de room court + QR (Lot 9, PLAN_V2.md) : identifiant public à 6 caractères que les
// joueurs saisissent ou scannent pour rejoindre une room. Alphabet volontairement restreint
// (pas de 0/O ni 1/I/L) pour rester lisible/dictable à voix haute sur un écran principal.

import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

// Encode le lien de room (pas juste le code brut) : un joueur qui scanne le QR doit atterrir
// directement sur l'écran "rejoindre" avec le code pré-rempli, pas devoir le retaper.
export function buildRoomJoinUrl(webBaseUrl: string, code: string): string {
  return `${webBaseUrl.replace(/\/+$/, '')}/rooms/join?code=${code}`;
}

// Data URL PNG (base64) du QR — directement affichable dans un <img src>. SVG écarté ici :
// le front consomme cette valeur telle quelle sans re-render, un data URL est plus simple à
// transporter dans le JSON de réponse REST qu'un fragment SVG à injecter en toute sécurité.
export async function generateRoomQr(joinUrl: string): Promise<string> {
  return QRCode.toDataURL(joinUrl, { errorCorrectionLevel: 'M', margin: 1 });
}
