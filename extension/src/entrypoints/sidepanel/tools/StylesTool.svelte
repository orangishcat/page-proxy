<script lang="ts">
  import {onDestroy} from 'svelte';
  import type {StylesToolEntry} from './styles/state';
  import {styleEntriesDisplay} from './styles/state';
  let styleEntriesValue = $state<StylesToolEntry[]>([]);
  const unsubscribeStyleEntries = styleEntriesDisplay.subscribe((value) => {
    styleEntriesValue = value;
  });

  onDestroy(() => {
    unsubscribeStyleEntries();
  });
</script>

<div class="flex w-full min-h-0 flex-1 flex-col px-4 py-4">
  <div class="min-h-0 flex-1 space-y-3 overflow-y-auto">
    {#each styleEntriesValue as entry (entry.name)}
      <div class="rounded-lg bg-gray-200 p-4 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        <div class="flex place-items-center justify-between gap-6">
          <div class="space-y-1 text-right w-[30%]">
            <span class="text-lg">{entry.name}</span>
            <div class="text-caption text-gray-600 dark:text-gray-300">
              {entry.propertyCount} props
            </div>
          </div>
          <div class="text-caption text-right w-full text-gray-600 dark:text-gray-300 line-clamp-2">
            {entry.propertyNamesText}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
