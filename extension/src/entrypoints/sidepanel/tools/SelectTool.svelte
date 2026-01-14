<script lang="ts">
  import {onDestroy} from 'svelte';
  import Button from '@/lib/components/Button.svelte';
  import type {PropertyItem} from './select-tool/state';
  import {hasSelection, propertyItems} from './select-tool/state';

  type SelectToolProps = {
    onSaveToStyles: () => void;
  };

  let {onSaveToStyles}: SelectToolProps = $props();
  let hasSelectionValue = $state(false);
  let propertyItemsValue = $state<PropertyItem[]>([]);

  const unsubscribeHasSelection = hasSelection.subscribe((value) => {
    hasSelectionValue = value;
  });
  const unsubscribePropertyItems = propertyItems.subscribe((value) => {
    propertyItemsValue = value;
  });

  onDestroy(() => {
    unsubscribeHasSelection();
    unsubscribePropertyItems();
  });
</script>

<div class="flex w-full min-h-0 shrink-0 flex-1 flex-col px-4 py-4">
  <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
    {#if hasSelectionValue}
      <div class="grid grid-cols-[fit-content(7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-body whitespace-pre-line">
        {#each propertyItemsValue as prop (prop.key)}
          <span class="min-w-0 text-right truncate text-gray-500">{prop.label}</span>
          <span class="min-w-0 break-words text-left">{prop.value}</span>
        {/each}
      </div>
    {:else}
      <div class="text-caption text-gray-500 dark:text-gray-400 flex h-full justify-center place-items-center">
        Select an element to preview
      </div>
    {/if}
  </div>
  <div class="flex mt-4 items-center justify-center">
    <Button
      class="w-42 text-sm {hasSelectionValue || 'hidden'}"
      variant="primary"
      onclick={onSaveToStyles}
      disabled={!hasSelectionValue}
    >
      Save to styles
    </Button>
  </div>
</div>
