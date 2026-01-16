<script lang="ts">
  import {onDestroy} from 'svelte';
  import Button from '@/lib/components/Button.svelte';
  import type {PropertyItem} from './select-tool/state';
  import {sendSelectParent, sendSelectorPopup} from './select-tool/actions';
  import {hasSelection, propertyItems} from './select-tool/state';
  import {ArrowUpIcon} from 'lucide-svelte';
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
  <div class="relative mt-4 flex w-full items-center justify-center">
    <Button
      class={`left-0 h-8 w-8 !p-0 rounded-lg text-white dark:text-white bg-[#55503E] hover:opacity-55 active:opacity-40 ${hasSelectionValue ? 'absolute' : 'hidden'}`}
      variant="outline"
      aria-label="Select parent element"
      onclick={sendSelectParent}
      disabled={!hasSelectionValue}
    >
      <ArrowUpIcon class="h-5 w-5" />
    </Button>
    <Button
      class={`w-40 text-sm ${hasSelectionValue ? '' : 'hidden'}`}
      variant="primary"
      onclick={sendSelectorPopup}
      disabled={!hasSelectionValue}
    >
      Save selector
    </Button>
  </div>
</div>
