<script lang="ts" module>
  // Classement de session (Lot 7 v2, GAME_DESIGN_V2.md §0.1/§6.5) : le SEUL classement du
  // jeu, dérivé de l'état de partie en mémoire, jamais persisté. Réutilisé "en cours"
  // (LeaderboardOverlay, scores provisoires) et "final" (End.svelte, réponse serveur).
  export interface LeaderboardEntry {
    pseudo: string;
    score: number;
    bestStreak: number;
    // Précision (bonnes réponses / total) : uniquement connue côté serveur (End.svelte) ;
    // absente en cours de partie (LeaderboardOverlay n'affiche alors pas la colonne).
    accuracy?: number;
    isWinner?: boolean;
  }
</script>

<script lang="ts">
  import { t } from '../i18n';
  import Icon from './Icon.svelte';

  interface Props {
    entries: LeaderboardEntry[];
    // 'final' : hiérarchie visuelle appuyée (le·s vainqueur·s ressortent, plus d'espace,
    // médaille). 'compact' : liste dense pour l'overlay en cours de partie.
    variant?: 'final' | 'compact';
  }

  const { entries, variant = 'compact' }: Props = $props();

  interface RankedEntry extends LeaderboardEntry {
    rank: number;
  }

  // Rangs denses avec ex-æquo (GAME_DESIGN_V2.md §1.3) : deux scores égaux partagent le même
  // rang, le rang suivant reprend au rang + 1 (pas de "saut" à la façon 1-2-2-4).
  function rankEntries(list: LeaderboardEntry[]): RankedEntry[] {
    const sorted = [...list].sort((a, b) => b.score - a.score);
    let rank = 0;
    let previousScore: number | null = null;
    return sorted.map((entry) => {
      if (entry.score !== previousScore) {
        rank += 1;
        previousScore = entry.score;
      }
      return { ...entry, rank };
    });
  }

  const ranked = $derived(rankEntries(entries));
</script>

<ol class="leaderboard leaderboard--{variant}">
  {#each ranked as entry (entry.pseudo)}
    <li class="leaderboard__row" class:leaderboard__row--lead={entry.rank === 1}>
      <span class="leaderboard__rank" data-numeric>{entry.rank}</span>
      <div class="leaderboard__identity">
        <span class="leaderboard__pseudo">{entry.pseudo}</span>
        {#if variant === 'final' && (entry.isWinner ?? entry.rank === 1)}
          <Icon name="seal" size="sm" />
        {/if}
      </div>
      {#if variant === 'final' && entry.accuracy !== undefined}
        <span class="leaderboard__meta">{t('leaderboard.accuracy_short', { value: Math.round(entry.accuracy * 100) })}</span>
      {/if}
      <span class="leaderboard__meta">
        <Icon name="lightning" size="sm" />
        {entry.bestStreak}
      </span>
      <span class="leaderboard__score" data-numeric>{entry.score}</span>
    </li>
  {/each}
</ol>

<style>
  .leaderboard {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .leaderboard__row {
    display: grid;
    grid-template-columns: 1.75rem 1fr auto auto;
    align-items: center;
    gap: var(--gap-tight);
    padding: 0.625rem 0.75rem;
    background: var(--board-raised);
    border-radius: var(--radius-card);
  }

  .leaderboard--final .leaderboard__row {
    padding: 0.875rem 1rem;
  }

  .leaderboard__row--lead {
    border-top: 0.125rem solid var(--amber);
    background: var(--amber-dim);
  }

  .leaderboard__rank {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-body);
    color: var(--ink-mid);
    text-align: center;
  }

  .leaderboard__row--lead .leaderboard__rank {
    color: var(--amber);
  }

  .leaderboard__identity {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    color: var(--amber);
  }

  .leaderboard__pseudo {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
    color: var(--ink-hi);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .leaderboard--final .leaderboard__pseudo {
    font-size: var(--fs-heading);
  }

  .leaderboard__meta {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    color: var(--ink-mid);
    white-space: nowrap;
  }

  .leaderboard__score {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-lead);
    color: var(--flap-ink);
    background: var(--flap);
    border-radius: var(--radius-flap);
    padding: 0.1em 0.5em;
    box-shadow: 0 0.125rem 0 var(--hinge);
  }
</style>
