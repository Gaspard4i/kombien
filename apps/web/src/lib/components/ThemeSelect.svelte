<script lang="ts">
  // Sélection de thème réutilisable (GAME_DESIGN_V2.md §2) : 5 modes possibles, chacun
  // avec sa propre UI de choix de catégorie(s). Le composant résout tout au setup et
  // expose une ThemeSelection prête à consommer par gameStore (le rendu détaillé de
  // chaque mode -- single/multi/per-player/vote -- vit ici pour rester réutilisable
  // ailleurs si besoin, plutôt que dans Setup.svelte).
  import { t, getLang } from '../i18n';
  import type { Category } from '../api/types';
  import type { ThemeSelectionMode, ThemeSelection } from '../stores/gameStore.svelte';
  import Card from './Card.svelte';
  import Button from './Button.svelte';

  interface Props {
    categories: Category[];
    pseudos: string[];
    selection: ThemeSelection;
    onchange: (selection: ThemeSelection) => void;
  }

  const { categories, pseudos, selection, onchange }: Props = $props();

  const MODES: ThemeSelectionMode[] = ['rotation', 'global', 'vote', 'multi', 'per_player'];

  // Vote pass-and-play : un joueur à la fois, sans voir le choix des précédents.
  let voteStep = $state(0);
  let votes = $state<string[]>([]);

  function categoryLabel(category: Category): string {
    return getLang() === 'en' ? category.name_en : category.name_fr;
  }

  function setMode(mode: ThemeSelectionMode): void {
    voteStep = 0;
    votes = [];
    onchange({ mode });
  }

  function pickGlobal(category: Category): void {
    onchange({ ...selection, fixedCategory: category });
  }

  function toggleMulti(category: Category): void {
    const current = selection.multiCategories ?? [];
    const exists = current.some((c) => c.id === category.id);
    const next = exists ? current.filter((c) => c.id !== category.id) : [...current, category];
    onchange({ ...selection, multiCategories: next });
  }

  function togglePerPlayer(playerIndex: number, category: Category): void {
    const current = selection.perPlayerCategories ?? pseudos.map(() => []);
    const playerCategories = current[playerIndex] ?? [];
    const exists = playerCategories.some((c) => c.id === category.id);
    const nextPlayerCategories = exists
      ? playerCategories.filter((c) => c.id !== category.id)
      : [...playerCategories, category];
    const next = current.map((cats, i) => (i === playerIndex ? nextPlayerCategories : cats));
    onchange({ ...selection, perPlayerCategories: next });
  }

  function castVote(category: Category): void {
    votes = [...votes, category.slug];
    if (voteStep + 1 < pseudos.length) {
      voteStep += 1;
      return;
    }
    onchange({ ...selection, fixedCategory: resolveVoteWinner(votes) });
  }

  // Égalité de vote (GAME_DESIGN_V2.md §2.2) : tirage aléatoire uniforme parmi les
  // catégories à égalité, annoncé explicitement (jamais silencieux).
  function resolveVoteWinner(castVotes: string[]): Category {
    const counts = new Map<string, number>();
    for (const slug of castVotes) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    const maxCount = Math.max(...counts.values());
    const topSlugs = [...counts.entries()].filter(([, n]) => n === maxCount).map(([slug]) => slug);
    const winnerSlug = topSlugs[Math.floor(Math.random() * topSlugs.length)]!;
    return categories.find((c) => c.slug === winnerSlug)!;
  }

  const isMultiSelectValid = $derived((selection.multiCategories?.length ?? 0) > 0);
  const isPerPlayerValid = $derived(
    pseudos.every((_, i) => (selection.perPlayerCategories?.[i]?.length ?? 0) > 0),
  );
  const voteInProgress = $derived(selection.mode === 'vote' && !selection.fixedCategory);
</script>

<section class="theme-select">
  <h2 class="theme-select__title">{t('theme_select.title')}</h2>

  <div class="theme-select__mode-list">
    {#each MODES as m (m)}
      <button
        type="button"
        class="theme-select__mode"
        class:theme-select__mode--selected={selection.mode === m}
        onclick={() => setMode(m)}
      >
        <span class="theme-select__mode-name">{t(`theme_select.mode_${m}`)}</span>
        <span class="theme-select__mode-desc">{t(`theme_select.mode_${m}_desc`)}</span>
      </button>
    {/each}
  </div>

  {#if selection.mode === 'rotation'}
    <!-- Rien de plus ici : la catégorie de la manche 1 reste choisie via le champ
         "category" existant du Setup, les manches suivantes via CategoryPick en jeu. -->
  {:else if selection.mode === 'global'}
    <Card>
      <h3 class="theme-select__section-title">{t('theme_select.single_select_title')}</h3>
      <div class="theme-select__grid">
        {#each categories as category (category.id)}
          <button
            type="button"
            class="theme-select__option"
            class:theme-select__option--selected={selection.fixedCategory?.id === category.id}
            onclick={() => pickGlobal(category)}
          >
            {categoryLabel(category)}
          </button>
        {/each}
      </div>
    </Card>
  {:else if selection.mode === 'multi'}
    <Card>
      <h3 class="theme-select__section-title">{t('theme_select.multi_select_title')}</h3>
      <div class="theme-select__grid">
        {#each categories as category (category.id)}
          <button
            type="button"
            class="theme-select__option"
            class:theme-select__option--selected={(selection.multiCategories ?? []).some((c) => c.id === category.id)}
            onclick={() => toggleMulti(category)}
          >
            {categoryLabel(category)}
          </button>
        {/each}
      </div>
      {#if !isMultiSelectValid}
        <p class="theme-select__hint">{t('theme_select.multi_select_hint')}</p>
      {/if}
    </Card>
  {:else if selection.mode === 'per_player'}
    <p class="theme-select__hint">{t('theme_select.per_player_hint')}</p>
    {#each pseudos as pseudo, playerIndex (playerIndex)}
      <Card>
        <h3 class="theme-select__section-title">{t('theme_select.per_player_title', { pseudo })}</h3>
        <div class="theme-select__grid">
          {#each categories as category (category.id)}
            <button
              type="button"
              class="theme-select__option"
              class:theme-select__option--selected={(selection.perPlayerCategories?.[playerIndex] ?? []).some(
                (c) => c.id === category.id,
              )}
              onclick={() => togglePerPlayer(playerIndex, category)}
            >
              {categoryLabel(category)}
            </button>
          {/each}
        </div>
      </Card>
    {/each}
    {#if !isPerPlayerValid}
      <p class="theme-select__hint">{t('theme_select.errors.per_player_min_one')}</p>
    {/if}
  {:else if selection.mode === 'vote'}
    {#if voteInProgress}
      <Card>
        <p class="theme-select__vote-intro">{t('theme_select.vote_intro')}</p>
        <h3 class="theme-select__section-title">
          {t('theme_select.vote_prompt', { pseudo: pseudos[voteStep] ?? '' })}
        </h3>
        <div class="theme-select__grid">
          {#each categories as category (category.id)}
            <button
              type="button"
              class="theme-select__option"
              onclick={() => castVote(category)}
            >
              {categoryLabel(category)}
            </button>
          {/each}
        </div>
      </Card>
    {:else if selection.fixedCategory}
      <Card>
        <p class="theme-select__vote-result">
          {t('theme_select.vote_result', { category: categoryLabel(selection.fixedCategory) })}
        </p>
        <Button variant="ghost" onclick={() => { voteStep = 0; votes = []; onchange({ ...selection, fixedCategory: undefined }); }}>
          {t('common.retry')}
        </Button>
      </Card>
    {/if}
  {/if}
</section>

<style>
  .theme-select {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .theme-select__title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
  }

  .theme-select__mode-list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-tight);
  }

  .theme-select__mode {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    min-height: var(--touch-min);
    padding: 0.75rem 1rem;
    background: var(--board-raised);
    border: 1px solid var(--ink-lo);
    border-radius: var(--radius-card);
    color: var(--ink-hi);
    text-align: left;
    cursor: pointer;
  }

  .theme-select__mode--selected {
    border-color: var(--amber);
    box-shadow: 0 0 0 1px var(--amber);
  }

  .theme-select__mode-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-body);
  }

  .theme-select__mode-desc {
    font-size: var(--fs-micro);
    color: var(--ink-mid);
  }

  .theme-select__section-title {
    font-family: var(--font-display);
    font-size: var(--fs-body);
    font-weight: 700;
    color: var(--ink-hi);
    margin-bottom: var(--gap-tight);
  }

  .theme-select__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight);
  }

  .theme-select__option {
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    cursor: pointer;
  }

  .theme-select__option--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }

  .theme-select__hint {
    color: var(--ink-mid);
    font-size: var(--fs-micro);
    margin-top: var(--gap-tight);
  }

  .theme-select__vote-intro {
    color: var(--ink-mid);
    font-size: var(--fs-micro);
    margin-bottom: var(--gap-tight);
  }

  .theme-select__vote-result {
    color: var(--ink-hi);
    font-size: var(--fs-body);
    margin-bottom: var(--gap-tight);
  }
</style>
