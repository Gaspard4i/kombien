<script lang="ts">
  // Révélation de la durée réelle en room (Lot 9) : même moment fort qu'en pass-and-play
  // (DESIGN_SYSTEM.md §5.3, cf screens/game/RevealPanel.svelte), factorisé ici car identique
  // dans les 3 vues (écran principal, manette MJ, appareil joueur) -- room:results ne porte
  // qu'une seule durationSeconds (pas de questions différenciées en room, cf protocol.ts).
  import { t } from '../../lib/i18n';
  import { formatSplitFlapDuration } from '../../lib/domain/formatDuration';
  import SplitFlap from '../../lib/components/SplitFlap.svelte';

  interface Props {
    durationSeconds: number;
    lang: 'fr' | 'en';
  }

  const { durationSeconds, lang }: Props = $props();

  const formatted = $derived(formatSplitFlapDuration(durationSeconds, lang));
</script>

<div class="room-reveal">
  <span class="room-reveal__label">{t('reveal.real_duration')}</span>
  <div class="room-reveal__flap">
    <SplitFlap value={formatted} size="mega" />
  </div>
</div>

<style>
  .room-reveal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--gap-tight);
  }

  .room-reveal__label {
    font-family: var(--font-mono);
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mid);
  }

  .room-reveal__flap {
    display: flex;
    justify-content: center;
    max-width: 100%;
  }
</style>
