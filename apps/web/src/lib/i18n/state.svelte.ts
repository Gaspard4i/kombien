import fr from './locales/fr.json';
import en from './locales/en.json';

export type Lang = 'fr' | 'en';

const STORAGE_KEY = 'kombien:lang';

const dictionaries: Record<Lang, Record<string, unknown>> = { fr, en };

function detectInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;

  const navigatorLang = navigator.language?.slice(0, 2).toLowerCase();
  return navigatorLang === 'en' ? 'en' : 'fr';
}

let currentLang = $state<Lang>(detectInitialLang());

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
}

function resolve(dict: Record<string, unknown>, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
  return typeof value === 'string' ? value : undefined;
}

/** Traduit `key` (chemin pointé, ex: "setup.title") avec interpolation `{{param}}`. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLang] ?? dictionaries.fr;
  const template = resolve(dict, key) ?? resolve(dictionaries.fr, key) ?? key;

  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [param, value]) => acc.replaceAll(`{{${param}}}`, String(value)),
    template,
  );
}

// Applique la langue détectée au <html lang="..."> dès le chargement du module. getLang()
// plutôt que currentLang directement : lire le $state au top-level du module (hors closure)
// déclenche state_referenced_locally (Svelte docs), même si ici une seule lecture suffit.
document.documentElement.lang = getLang();
