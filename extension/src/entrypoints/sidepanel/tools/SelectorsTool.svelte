<script lang="ts">
  import { Collapsible } from "bits-ui";
  import { onMount } from "svelte";
  import type { SelectorsToolEntry } from "./selectors/state";
  import { selectorEntriesDisplay } from "./selectors/state";

  let selectorEntriesValue = $state<SelectorsToolEntry[]>([]);

  const formatRuleCount = (ruleCount: number) => `${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}`;

  onMount(() => {
    const unsubscribeSelectorEntries = selectorEntriesDisplay.subscribe((value) => {
      selectorEntriesValue = value;
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
        <Collapsible.Root class="rounded-lg border border-[#4f4a38] bg-[#2d2b25] text-gray-100 group">
          <Collapsible.Trigger
            class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#37332c]"
          >
            <div class="flex min-w-0 items-center gap-2">
              <span class="w-3 shrink-0 text-center text-2xl text-gray-300 transition-transform duration-200 group-data-[state=open]:rotate-90">
                ▸
              </span>
              <span class="truncate text-sm text-accent-500">{entry.name}</span>
            </div>
            <span class="text-caption text-gray-400">{formatRuleCount(entry.ruleCount)}</span>
          </Collapsible.Trigger>

          <Collapsible.Content class="space-y-1 border-t border-[#4f4a38] px-3 py-2">
            {#if entry.rules.length === 0}
              <div class="rounded-md bg-[#24231f] px-2 py-1 text-caption text-gray-500">No rules</div>
            {:else}
              {#each entry.rules as rule, index (`${entry.name}-${index}-${rule}`)}
                <div class="rounded-md bg-[#24231f] px-2 py-1 font-mono text-xs text-secondary-500">{rule}</div>
              {/each}
            {/if}
          </Collapsible.Content>
        </Collapsible.Root>
      {/each}
    </div>
  {/if}
</div>
