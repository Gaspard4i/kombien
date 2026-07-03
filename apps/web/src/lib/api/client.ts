import type {
  Category,
  CreateQuestionInput,
  CreateQuestionResult,
  Question,
  ReportQuestionResult,
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

export function createQuestion(input: CreateQuestionInput): Promise<CreateQuestionResult> {
  return request('/questions', { method: 'POST', body: JSON.stringify(input) });
}

export function reportQuestion(id: number): Promise<ReportQuestionResult> {
  return request(`/questions/${id}/report`, { method: 'POST' });
}

export function submitGame(input: SubmitGameInput): Promise<SubmitGameResult> {
  return request('/games', { method: 'POST', body: JSON.stringify(input) });
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
