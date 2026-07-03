<script lang="ts">
  // Profil joueur (API_CONTRACT.md GET /players/:pseudo) : stats cumulées + badges
  // débloqués/verrouillés (tous les slugs de badges connus, DESIGN_SYSTEM.md §5.7 : le
  // verrouillé montre sa silhouette, jamais caché).
  import { t, getLang } from '../lib/i18n';
  import { navigate } from '../lib/router/router.svelte';
  import { getPlayer, ApiError } from '../lib/api/client';
  import type { PlayerProfile } from '../lib/api/types';
  import AppShell from '../lib/components/AppShell.svelte';
  import Card from '../lib/components/Card.svelte';
  import Button from '../lib/components/Button.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import ErrorMessage from '../lib/components/ErrorMessage.svelte';
  import Icon from '../lib/components/Icon.svelte';

  const ALL_BADGE_SLUGS = [
    'first_game',
    'speedrunner',
    'bullseye',
    'perfect_round',
    'on_fire',
    'sharpshooter',
    'duel_master',
    'centurion',
    'polyglot',
    'time_lord',
  ] as const;

  interface Props {
    pseudo: string;
  }

  const { pseudo }: Props = $props();

  let profile = $state<PlayerProfile | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let searchValue = $state('');

  // Le routeur peut naviguer vers un autre pseudo sans démonter ce composant : on
  // recharge à chaque changement de la prop (au lieu d'un onMount figé sur la 1re valeur).
  $effect(() => {
    searchValue = pseudo;
    load(pseudo);
  });

  function handleSearch(): void {
    const target = searchValue.trim();
    if (target && target !== pseudo) {
      navigate({ name: 'profile', pseudo: target });
    }
  }

  async function load(pseudoToLoad: string): Promise<void> {
    loading = true;
    loadError = null;
    profile = null;
    try {
      profile = await getPlayer(pseudoToLoad);
    } catch (err) {
      loadError = err instanceof ApiError ? t(`errors.${err.code}`) : t('errors.unknown_error');
    } finally {
      loading = false;
    }
  }

  function unlockedAt(slug: string): string | null {
    return profile?.badges.find((b) => b.slug === slug)?.unlocked_at ?? null;
  }

  function formatDate(iso: string): string {
    return new Intl.DateTimeFormat(getLang() === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium' }).format(new Date(iso));
  }
</script>

<AppShell>
  <header class="profile__header">
    <Button variant="ghost" onclick={() => navigate({ name: 'leaderboard' })}>
      <Icon name="caret-left" size="md" />
      {t('nav.back')}
    </Button>
  </header>

  <form class="profile__search" onsubmit={(e) => (e.preventDefault(), handleSearch())}>
    <input
      class="profile__search-input"
      type="text"
      aria-label={t('profile.search_placeholder')}
      placeholder={t('profile.search_placeholder')}
      bind:value={searchValue}
    />
    <Button type="submit" variant="secondary">{t('profile.search')}</Button>
  </form>

  {#if loading}
    <Skeleton rows={5} />
  {:else if loadError}
    <ErrorMessage message={loadError} />
  {:else if profile}
    <h1 class="profile__title">{t('profile.title', { pseudo: profile.pseudo })}</h1>
    <p class="profile__since">{t('profile.member_since', { date: formatDate(profile.created_at) })}</p>

    <Card>
      <dl class="profile__stats">
        <div class="profile__stat">
          <dt>{t('profile.games_played')}</dt>
          <dd data-numeric>{profile.stats.games}</dd>
        </div>
        <div class="profile__stat">
          <dt>{t('profile.wins')}</dt>
          <dd data-numeric>{profile.stats.wins}</dd>
        </div>
        <div class="profile__stat">
          <dt>{t('profile.duels_won')}</dt>
          <dd data-numeric>{profile.duels_won}</dd>
        </div>
        <div class="profile__stat">
          <dt>{t('profile.total_score')}</dt>
          <dd data-numeric>{profile.stats.total_score}</dd>
        </div>
        <div class="profile__stat">
          <dt>{t('profile.best_streak')}</dt>
          <dd data-numeric>{profile.stats.best_streak}</dd>
        </div>
        <div class="profile__stat">
          <dt>{t('profile.avg_accuracy')}</dt>
          <dd data-numeric>{Math.round(profile.stats.avg_accuracy * 100)}%</dd>
        </div>
        <div class="profile__stat">
          <dt>{t('leaderboard.xp')}</dt>
          <dd data-numeric>{profile.xp}</dd>
        </div>
        <div class="profile__stat">
          <dt>{t('leaderboard.level')}</dt>
          <dd data-numeric>{profile.level}</dd>
        </div>
      </dl>
    </Card>

    <section class="profile__badges">
      <h2 class="profile__badges-title">{t('profile.badges_title')}</h2>
      <div class="profile__badge-grid">
        {#each ALL_BADGE_SLUGS as slug (slug)}
          {@const unlocked = unlockedAt(slug)}
          <div class="profile__badge" class:profile__badge--unlocked={unlocked !== null}>
            <Icon name="medal-military" size="lg" />
            <span class="profile__badge-name">{t(`badges.${slug}`)}</span>
            {#if !unlocked}
              <span class="profile__badge-locked">{t('profile.badge_locked')}</span>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}
</AppShell>

<style>
  .profile__header {
    display: flex;
  }

  .profile__title {
    font-family: var(--font-display);
    font-size: var(--fs-title);
    font-weight: 700;
    color: var(--ink-hi);
  }

  .profile__since {
    color: var(--ink-mid);
    font-size: var(--fs-micro);
    margin-top: -0.5rem;
  }

  .profile__search {
    display: flex;
    gap: var(--gap-tight);
  }

  .profile__search-input {
    flex: 1;
    min-height: var(--touch-min);
    padding: 0.5rem 0.75rem;
    background: var(--flap);
    color: var(--flap-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-body);
    border: none;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
  }

  .profile__search-input::placeholder {
    color: var(--ink-lo);
  }

  .profile__stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight) var(--gap);
    margin: 0;
  }

  .profile__stat {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .profile__stat dt {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .profile__stat dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: var(--fs-heading);
    color: var(--ink-hi);
  }

  .profile__badges {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  .profile__badges-title {
    font-family: var(--font-display);
    font-size: var(--fs-heading);
    font-weight: 500;
    color: var(--ink-hi);
  }

  .profile__badge-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap-tight);
  }

  @media (min-width: 640px) {
    .profile__badge-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .profile__badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: var(--gap);
    background: var(--board-raised);
    border-radius: var(--radius-card);
    color: var(--ink-lo);
    text-align: center;
  }

  .profile__badge--unlocked {
    background: var(--flap);
    color: var(--flap-ink);
    box-shadow: 0 0 0 0.125rem var(--amber);
  }

  .profile__badge-name {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    font-weight: 700;
  }

  .profile__badge-locked {
    font-family: var(--font-mono);
    font-size: var(--fs-micro);
    color: var(--ink-lo);
  }
</style>
