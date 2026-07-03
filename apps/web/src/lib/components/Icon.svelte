<script lang="ts" module>
  // Icônes Phosphor bold auto-hébergées (DESIGN_SYSTEM.md §4) : trait net, currentColor.
  const svgModules = import.meta.glob('../../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true });

  const svgByName: Record<string, string> = {};
  for (const [path, content] of Object.entries(svgModules)) {
    const name = path.split('/').pop()!.replace('.svg', '');
    svgByName[name] = content as string;
  }
</script>

<script lang="ts">
  export type IconName =
    | 'clock'
    | 'arrows-clockwise'
    | 'stack'
    | 'lightning'
    | 'seal'
    | 'user-square'
    | 'hand-tap'
    | 'check'
    | 'warning'
    | 'squares-four'
    | 'translate'
    | 'x'
    | 'medal-military'
    | 'plus'
    | 'minus'
    | 'caret-left'
    | 'caret-right';

  interface Props {
    name: IconName;
    size?: 'sm' | 'md' | 'lg';
  }

  const { name, size = 'md' }: Props = $props();
  const markup = $derived(svgByName[name] ?? '');
</script>

<span class="icon icon--{size}" aria-hidden="true">
  {@html markup}
</span>

<style>
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }

  .icon :global(svg) {
    width: 1em;
    height: 1em;
    fill: currentColor;
  }

  .icon--sm {
    font-size: 1rem;
  }

  .icon--md {
    font-size: 1.25rem;
  }

  .icon--lg {
    font-size: 1.5rem;
  }
</style>
