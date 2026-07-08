import type {
  CalibrationQuestion,
  Category,
  CreateQuestionInput,
  CreateQuestionResult,
  CreateRoomInput,
  CreateRoomResult,
  Question,
  ReportQuestionResult,
  RoomInfo,
  SubmitGameInput,
  SubmitGameResult,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:3000' : '/api');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        // Content-Type uniquement s'il y a un corps : Fastify rejette (400
        // FST_ERR_CTP_EMPTY_JSON_BODY) un POST sans body qui annonce application/json
        // (cas des routes admin approve/reject/report, appelées sans payload).
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }

  if (!response.ok) {
    let code = 'unknown_error';
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) code = body.error;
    } catch {
      // Réponse d'erreur sans corps JSON exploitable : on garde le code générique.
    }
    throw new ApiError(response.status, code, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function getHealth(): Promise<{ status: string }> {
  return request('/health');
}

export function getCategories(): Promise<Category[]> {
  return request('/categories');
}

export function getCategoryQuestions(slug: string, count = 5): Promise<Question[]> {
  return request(`/categories/${encodeURIComponent(slug)}/questions?count=${count}`);
}

// Tirage multi-catégories (Lot 2 v2, GAME_DESIGN_V2.md §2.3-2.4) : union des
// questions approuvées de plusieurs catégories. Utilisé par les modes de
// sélection de thème "multi-thèmes" et "par joueur".
export function getQuestionsForCategories(slugs: string[], count = 5): Promise<Question[]> {
  const categories = slugs.map(encodeURIComponent).join(',');
  return request(`/questions?categories=${categories}&count=${count}`);
}

// Tirage en sous-ensembles disjoints par joueur (Lot 3 v2, GAME_DESIGN_V2.md §5.2) : option
// "questions différenciées". Réponse alignée sur l'ordre des joueurs (PlayerSlot[]).
export function getDistinctQuestionsForPlayers(
  slugs: string[],
  count: number,
  playerCount: number,
): Promise<Question[][]> {
  const categories = slugs.map(encodeURIComponent).join(',');
  return request(`/questions/distinct?categories=${categories}&count=${count}&players=${playerCount}`);
}

// Calibration du mode Binaire (Lot 4 v2, GAME_DESIGN_V2.md §3) : pool dédié, hors
// des catégories de jeu. count = 5 par défaut (§3.1).
export function getCalibrationQuestions(count = 5): Promise<CalibrationQuestion[]> {
  return request(`/calibration/questions?count=${count}`);
}

export function createQuestion(input: CreateQuestionInput): Promise<CreateQuestionResult> {
  return request('/questions', { method: 'POST', body: JSON.stringify(input) });
}

export function reportQuestion(id: number): Promise<ReportQuestionResult> {
  return request(`/questions/${id}/report`, { method: 'POST' });
}

export function submitGame(input: SubmitGameInput): Promise<SubmitGameResult> {
  return request('/games', { method: 'POST', body: JSON.stringify(input) });
}

// --- Rooms multi-écrans temps réel (Lot 9) ---

export function createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
  return request('/rooms', { method: 'POST', body: JSON.stringify(input) });
}

export function getRoomInfo(code: string): Promise<RoomInfo> {
  return request(`/rooms/${encodeURIComponent(code)}`);
}

// --- Admin (header x-admin-secret) ---

export interface PendingQuestion extends Question {
  status: string;
  category_slug?: string;
}

export function getPendingQuestions(adminSecret: string): Promise<PendingQuestion[]> {
  return request('/admin/questions?status=pending', {
    headers: { 'x-admin-secret': adminSecret },
  });
}

export function approveQuestion(id: number, adminSecret: string): Promise<void> {
  return request(`/admin/questions/${id}/approve`, {
    method: 'POST',
    headers: { 'x-admin-secret': adminSecret },
  });
}

export function rejectQuestion(id: number, adminSecret: string): Promise<void> {
  return request(`/admin/questions/${id}/reject`, {
    method: 'POST',
    headers: { 'x-admin-secret': adminSecret },
  });
}

// --- Import en masse (Lot 6) ---

export interface ImportRowError {
  line: number;
  errors: string[];
}

export interface ImportReport {
  total: number;
  imported: number;
  rejected: ImportRowError[];
}

export type ImportTemplateFormat = 'csv' | 'xlsx' | 'md';

// Pas de request() générique ici : réponse multipart/binaire (xlsx) et upload de
// fichier, pas du JSON pur des deux côtés.
export async function importQuestionsFile(file: File, adminSecret: string): Promise<ImportReport> {
  const body = new FormData();
  body.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/admin/questions/import`, {
      method: 'POST',
      headers: { 'x-admin-secret': adminSecret },
      body,
    });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }

  if (!response.ok) {
    let code = 'unknown_error';
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody?.error) code = errBody.error;
    } catch {
      // Réponse d'erreur sans corps JSON exploitable : on garde le code générique.
    }
    throw new ApiError(response.status, code, code);
  }

  return (await response.json()) as ImportReport;
}

const TEMPLATE_FILENAMES: Record<ImportTemplateFormat, string> = {
  csv: 'kombien-import-template.csv',
  xlsx: 'kombien-import-template.xlsx',
  md: 'kombien-import-template.md',
};

// Un <a href> ne peut pas poser le header x-admin-secret : on récupère le
// fichier via fetch() puis on déclenche le téléchargement depuis un blob URL
// (le secret ne transite jamais par l'URL/les logs).
export async function downloadImportTemplate(format: ImportTemplateFormat, adminSecret: string): Promise<void> {
  const response = await fetch(`${API_BASE}/admin/questions/import/template?format=${format}`, {
    headers: { 'x-admin-secret': adminSecret },
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'template_download_error', 'template_download_error');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = TEMPLATE_FILENAMES[format];
  link.click();
  URL.revokeObjectURL(url);
}
