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

<div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
  {#if hasSelectionValue}
    <div class="grid grid-cols-[fit-content(7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-body whitespace-pre-line">
      {#each propertyItemsValue as prop (prop.key)}
        <span class="text-right truncate">{prop.label}</span>
        <span class="text-left">{prop.value}</span>
      {/each}
    </div>
  {:else}
    <div class="text-caption text-gray-500 dark:text-gray-400 flex justify-center place-items-center h-full">
      Select an element to preview
    </div>
  {/if}
  <div class="mt-auto flex justify-center">
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
