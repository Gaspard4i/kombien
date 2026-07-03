<script lang="ts">
  // Primitive partagée (DESIGN_SYSTEM.md §5.0) : une palette crème sur caisson, charnière
  // médiane visible, coins peu arrondis, relief par ombre dure. Tout composant "tableau"
  // (SplitFlap, cartes, badges, boutons secondaires) hérite de cette anatomie.
  interface Props {
    char?: string;
    size?: 'mega' | 'title' | 'label';
    tone?: 'flap' | 'amber' | 'raised';
  }

  const { char = '', size = 'title', tone = 'flap' }: Props = $props();
</script>

<span class="flap flap--{size} flap--{tone}" data-numeric aria-hidden={char === '' ? 'true' : undefined}>
  {char}
</span>

<style>
  .flap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    font-family: var(--font-mono);
    font-weight: 700;
    line-height: 1;
    border-radius: var(--radius-flap);
    box-shadow: 0 0.125rem 0 var(--hinge);
    /* Fente de charnière médiane : seul gradient toléré (simule le pli de la palette). */
    background-image: linear-gradient(
      var(--flap-bg) 0 calc(50% - 0.0625rem),
      var(--hinge) 50%,
      var(--flap-bg) calc(50% + 0.0625rem) 100%
    );
  }

  .flap--flap {
    --flap-bg: var(--flap);
    color: var(--flap-ink);
  }

  .flap--amber {
    --flap-bg: var(--amber);
    color: var(--amber-ink);
  }

  .flap--raised {
    --flap-bg: var(--board-raised);
    color: var(--ink-lo);
  }

  .flap--mega {
    font-size: clamp(2.5rem, 12vw, var(--fs-mega));
    min-width: 1.5em;
    padding: 0.1em 0.15em;
  }

  .flap--title {
    font-size: var(--fs-title);
    min-width: 1.4em;
    padding: 0.15em 0.3em;
  }

  .flap--label {
    font-size: var(--fs-label);
    letter-spacing: 0.08em;
    padding: 0.35em 0.6em;
  }
</style>
