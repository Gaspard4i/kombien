<script lang="ts">
  // Choix croisé de catégorie (GAME_DESIGN.md §9.2) : le chooser choisit la catégorie que
  // l'autre joueur devra estimer à la manche suivante.
  import { t, getLang } from '../../lib/i18n';
  import type { Category } from '../../lib/api/types';
  import Card from '../../lib/components/Card.svelte';
  import Button from '../../lib/components/Button.svelte';

  interface Props {
    chooserPseudo: string;
    answererPseudo: string;
    categories: Category[];
    onconfirm: (category: Category) => void;
  }

  const { chooserPseudo, answererPseudo, categories, onconfirm }: Props = $props();

  let selected = $state<Category | null>(null);
</script>

<div class="category-pick">
  <h2 class="category-pick__title">
    {t('category_pick.title', { chooser: chooserPseudo, answerer: answererPseudo })}
  </h2>

  <Card>
    <div class="category-pick__grid">
      {#each categories as category (category.id)}
        <button
          type="button"
          class="category-pick__option"
          class:category-pick__option--selected={selected?.id === category.id}
          onclick={() => (selected = category)}
        >
          {getLang() === 'en' ? category.name_en : category.name_fr}
        </button>
      {/each}
    </div>
  </Card>

  <Button variant="primary" fullWidth disabled={!selected} onclick={() => selected && onconfirm(selected)}>
    {t('category_pick.confirm')}
  </Button>
</div>

<style>
  .category-pick {
    display: flex;
    flex-direction: column;
    gap: var(--gap-wide);
  }

  .category-pick__title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
    text-align: center;
  }

  .category-pick__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight);
  }

  .category-pick__option {
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

  .category-pick__option--selected {
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 0.125rem 0 var(--amber-dim);
  }
</style>
