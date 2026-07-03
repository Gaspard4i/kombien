<script lang="ts">
  // Message d'erreur explicite (jamais blanc/silencieux, CLAUDE.md). Icône warning en --signal.
  import Icon from './Icon.svelte';

  interface Props {
    message: string;
  }

  const { message }: Props = $props();
</script>

<div class="error" role="alert">
  <Icon name="warning" size="md" />
  <span>{message}</span>
</div>

<style>
  .error {
    display: flex;
    align-items: center;
    gap: var(--gap-tight);
    color: var(--signal);
    background: var(--board-raised);
    border: 1px solid var(--signal);
    border-radius: var(--radius-card);
    padding: var(--gap) var(--pad-card);
    font-size: var(--fs-body);
  }
</style>
