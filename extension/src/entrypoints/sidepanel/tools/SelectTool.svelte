<script lang="ts">
  type SelectToolProps = {
    lines: string[];
    hasSelection: boolean;
    onSaveToStyles: () => void;
  };

  let {lines, hasSelection, onSaveToStyles}: SelectToolProps = $props();
</script>

<div class="h-full w-full">
  {#if hasSelection}
    <p class="pp-info-text absolute left-[6.5%] top-[31.3%] w-[86.75%] whitespace-pre-line">
      {lines.join('\n')}
    </p>
  {/if}
  <button
    class="pp-action-button absolute left-[33.73%] top-[80.24%] h-[12.46%] w-[27.02%] disabled:opacity-50"
    type="button"
    onclick={onSaveToStyles}
    disabled={!hasSelection}
  >
    Save to styles
  </button>
</div>
