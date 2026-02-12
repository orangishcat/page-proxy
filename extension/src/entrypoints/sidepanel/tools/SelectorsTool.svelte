<script lang="ts">
  import { onMount } from "svelte";
  import type { SelectorsToolEntry } from "./selectors/state";
  import { selectorEntriesDisplay } from "./selectors/state";

  let selectorEntriesValue = $state<SelectorsToolEntry[]>([]);
  let expandedSelectorNames = $state<string[]>([]);

  const toggleSelector = (selectorName: string) => {
    expandedSelectorNames = expandedSelectorNames.includes(selectorName)
      ? expandedSelectorNames.filter((name) => name !== selectorName)
      : [...expandedSelectorNames, selectorName];
  };

  const isExpanded = (selectorName: string) => expandedSelectorNames.includes(selectorName);

  const formatRuleCount = (ruleCount: number) => `${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}`;

  onMount(() => {
    const unsubscribeSelectorEntries = selectorEntriesDisplay.subscribe((value) => {
      selectorEntriesValue = value;
      expandedSelectorNames = expandedSelectorNames.filter((name) =>
        value.some((entry) => entry.name === name),
      );
    });

    return () => {
      unsubscribeSelectorEntries();
    };
  });
</script>

<div class="flex w-full min-h-0 flex-1 flex-col px-4 py-4">
  {#if selectorEntriesValue.length === 0}
    <div class="flex min-h-0 flex-1 items-center justify-center text-body text-gray-500 dark:text-gray-400">
      It&apos;s empty in here
    </div>
  {:else}
    <div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
      {#each selectorEntriesValue as entry (entry.name)}
        <div class="rounded-lg border border-[#4f4a38] bg-[#2d2b25] text-gray-100">
          <button
            type="button"
            onclick={() => toggleSelector(entry.name)}
            class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#37332c]"
            aria-expanded={isExpanded(entry.name)}
          >
            <div class="flex min-w-0 items-center gap-2">
              <span class="w-3 shrink-0 text-xs text-gray-500 text-center">
                {isExpanded(entry.name) ? "▾" : "▸"}
              </span>
              <span class="truncate text-sm text-accent-500">{entry.name}</span>
            </div>
            <span class="text-caption text-gray-400">{formatRuleCount(entry.ruleCount)}</span>
          </button>

          {#if isExpanded(entry.name)}
            <div class="space-y-1 border-t border-[#4f4a38] px-3 py-2">
              {#if entry.rules.length === 0}
                <div class="rounded-md bg-[#24231f] px-2 py-1 text-caption text-gray-500">No rules</div>
              {:else}
                {#each entry.rules as rule, index (`${entry.name}-${index}-${rule}`)}
                  <div class="rounded-md bg-[#24231f] px-2 py-1 font-mono text-xs text-secondary-500">{rule}</div>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
