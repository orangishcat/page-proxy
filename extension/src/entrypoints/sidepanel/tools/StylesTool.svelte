<script lang="ts">
  type StylesToolEntry = {
    name: string;
    selector: string;
    bboxText: string | null;
    propertyCount: number;
  };

  type StylesToolProps = {
    entries: StylesToolEntry[];
    canSave: boolean;
    onSaveStyle: () => void;
  };

  let {entries, canSave, onSaveStyle}: StylesToolProps = $props();
</script>

<div class="h-full w-full">
  <div class="absolute left-[5.63%] top-[23.1%] h-[69.6%] w-[89%] overflow-y-auto">
    {#each entries as entry (entry.name)}
      <div class="relative h-[34.5%] min-h-[31%] w-full bg-[#393a34]">
        <div class="absolute left-[3.65%] top-[18.99%]">
          <span class="pp-style-title">{entry.name}</span>
          <br />
          <span class="pp-style-meta">{entry.propertyCount} Properties</span>
        </div>
        <div class="pp-style-meta absolute left-[41.01%] top-[20.89%]">
          {#if entry.selector}
            <span>selector: “{entry.selector}”</span>
          {/if}
          {#if entry.bboxText}
            {#if entry.selector}
              <br />
            {/if}
            <span>bbox: [{entry.bboxText}]</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  <button
    class="pp-action-button absolute left-[36%] top-[79.03%] h-[11.25%] w-[28%] disabled:opacity-50"
    type="button"
    onclick={onSaveStyle}
    disabled={!canSave}
  >
    Save style
  </button>
</div>
