<script lang="ts">
  import {onDestroy} from 'svelte';
  import Button from '@/lib/components/Button.svelte';
  import type {StylesToolEntry} from './styles/state';
  import {hasSelection} from './select-tool/state';
  import {styleEntriesDisplay} from './styles/state';

  type StylesToolProps = {
    onSaveStyle: () => void;
  };

  let {onSaveStyle}: StylesToolProps = $props();
  let hasSelectionValue = $state(false);
  let styleEntriesValue = $state<StylesToolEntry[]>([]);

  const unsubscribeHasSelection = hasSelection.subscribe((value) => {
    hasSelectionValue = value;
  });
  const unsubscribeStyleEntries = styleEntriesDisplay.subscribe((value) => {
    styleEntriesValue = value;
  });

  onDestroy(() => {
    unsubscribeHasSelection();
    unsubscribeStyleEntries();
  });
</script>

<div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
  <div class="flex-1 space-y-3 overflow-y-auto">
    {#each styleEntriesValue as entry (entry.name)}
      <div class="rounded-lg bg-gray-200 p-4 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        <div class="flex flex-wrap justify-between gap-4">
          <div class="space-y-1">
            <span class="text-subtitle">{entry.name}</span>
            <div class="text-caption text-gray-600 dark:text-gray-300">
              {entry.propertyCount} Properties
            </div>
          </div>
          <div class="text-caption text-gray-600 dark:text-gray-300">
            {#if entry.selector}
              <div>selector: “{entry.selector}”</div>
            {/if}
            {#if entry.bboxText}
              <div>bbox: [{entry.bboxText}]</div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
  <div class="mt-auto flex justify-center">
    <Button
      class="w-full max-w-xs"
      variant="primary"
      onclick={onSaveStyle}
      disabled={!hasSelectionValue}
    >
      Save style
    </Button>
  </div>
</div>
