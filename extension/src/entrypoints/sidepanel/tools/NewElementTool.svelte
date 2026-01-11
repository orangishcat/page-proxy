<script lang="ts">
  type NewElementToolProps = {
    lines: string[];
    hasSelection: boolean;
    onCreate: () => void;
  };

  let {lines, hasSelection, onCreate}: NewElementToolProps = $props();
</script>

<div class="h-full w-full">
  {#if hasSelection}
    <p class="pp-info-text absolute left-[6.5%] top-[31.91%] w-[86.75%] whitespace-pre-line">
      {lines.join('\n')}
    </p>
  {/if}
  <button
    class="pp-action-button absolute left-[36%] top-[79.03%] h-[11.25%] w-[28%] disabled:opacity-50"
    type="button"
    onclick={onCreate}
    disabled={!hasSelection}
  >
    Create element
  </button>
</div>
