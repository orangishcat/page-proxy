<script lang="ts">
  type SaveStyleItem = {
    key: string;
    label: string;
    value: string;
  };

  type SaveStyleToolProps = {
    items: SaveStyleItem[];
    selections: Record<string, boolean>;
    styleName: string;
    hasSelection: boolean;
    onToggleSelection: (key: string, checked: boolean) => void;
    onSave: () => void;
    onStyleNameChange: (value: string) => void;
  };

  let {
    items,
    selections,
    styleName,
    hasSelection,
    onToggleSelection,
    onSave,
    onStyleNameChange
  }: SaveStyleToolProps = $props();
</script>

<div class="h-full w-full">
  <div class="absolute left-[8.75%] top-[20.67%] h-[9.42%] w-[82.5%]">
    <div class="grid h-full w-full grid-cols-[13.33%,4.55%,65.15%,4.55%,12.42%] items-center">
      <span class="pp-name-label">Name:</span>
      <span></span>
      <input
        class="pp-input-text h-full w-full rounded-[12.5%] bg-[#32332e]/20 px-[3.72%] text-white"
        type="text"
        value={styleName}
        disabled={!hasSelection}
        oninput={(event) => onStyleNameChange(event.currentTarget.value)}
      />
      <span></span>
      <button
        class="pp-action-button h-[96%] w-full disabled:opacity-50"
        type="button"
        onclick={onSave}
        disabled={!hasSelection}
      >
        Save
      </button>
    </div>
  </div>
  <div class="absolute left-[7.75%] top-[34.95%] h-[56.23%] w-[84.5%]">
    <div class="absolute left-[22.49%] top-0 h-full w-[0.3%] bg-[#d9d9d9]"></div>
    <div class="flex h-full flex-col overflow-y-auto">
      {#each items as item (item.key)}
        <div class="grid h-[20%] grid-cols-[22.49%,1fr] items-center bg-[#393a34]">
          <label class="flex items-center gap-[3.95%] pl-[2.96%]">
            <input
              class="h-[35%] w-[35%] rounded-[12.5%] border border-[#d9d9d9] bg-transparent accent-[#86d24b]"
              type="checkbox"
              checked={selections[item.key] ?? false}
              onchange={(event) => onToggleSelection(item.key, event.currentTarget.checked)}
            />
            <span class="pp-save-style-label">{item.label}</span>
          </label>
          <span class="pp-save-style-value pr-[2.96%]">{item.value}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
