<script lang="ts">
  import {onDestroy} from 'svelte';
  import type {SelectorsToolEntry} from './selectors/state';
  import {selectorEntriesDisplay} from './selectors/state';
  let selectorEntriesValue = $state<SelectorsToolEntry[]>([]);
  const unsubscribeSelectorEntries = selectorEntriesDisplay.subscribe((value) => {
    selectorEntriesValue = value;
  });

  onDestroy(() => {
    unsubscribeSelectorEntries();
  });
</script>

<div class="flex w-full min-h-0 flex-1 flex-col px-4 py-4">
  {#if selectorEntriesValue.length === 0}
    <div class="flex min-h-0 flex-1 items-center justify-center text-body text-gray-500 dark:text-gray-400">
      It&apos;s empty in here
    </div>
  {:else}
    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto">
      {#each selectorEntriesValue as entry (entry.name)}
        <div class="rounded-lg bg-gray-200 p-4 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
          <div class="flex place-items-center justify-between gap-6">
            <div class="space-y-1 text-right w-[30%]">
              <span class="text-lg">{entry.name}</span>
              <div class="text-caption text-gray-600 dark:text-gray-300">
                {entry.ruleCount} rules
              </div>
            </div>
            <div class="text-caption text-right w-full text-gray-600 dark:text-gray-300 line-clamp-2">
              {entry.ruleNamesText}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
