<script lang="ts">
  import { Collapsible, DropdownMenu } from "bits-ui";
  import { onDestroy, onMount } from "svelte";
  import { Pencil } from "lucide-svelte";
  import { sendSelectorsHover } from "./selectors/actions";
  import { sendSelectorPopup } from "./select-tool/actions";
  import type { SelectorsToolEntry } from "./selectors/state";
  import { selectorEntriesDisplay } from "./selectors/state";

  let selectorEntriesValue = $state<SelectorsToolEntry[]>([]);

  const actionMenuClasses =
    "z-20 min-w-36 rounded-md border border-gray-300 bg-gray-50 p-1 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100";
  const actionMenuItemClasses =
    "text-body flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-900/60 dark:active:bg-gray-900";

  const handleSelectorMouseEnter = (entry: SelectorsToolEntry) => {
    sendSelectorsHover({
      selectorName: entry.name,
      rules: entry.rules,
    });
  };

  const handleSelectorMouseLeave = () => {
    sendSelectorsHover(null);
  };

  const handleEditEntry = (entry: SelectorsToolEntry) => {
    sendSelectorPopup(entry.mode);
  };

  onMount(() => {
    const unsubscribeSelectorEntries = selectorEntriesDisplay.subscribe((value) => {
      selectorEntriesValue = value;
    });

    return () => {
      unsubscribeSelectorEntries();
    };
  });

  onDestroy(() => {
    sendSelectorsHover(null);
  });
</script>

<div class="flex w-full min-h-0 flex-1 flex-col px-4 py-4">
  <div class="min-h-0 flex-1">
    {#if selectorEntriesValue.length === 0}
      <div class="flex min-h-0 h-full items-center justify-center text-body text-gray-500 dark:text-gray-400">
        It&apos;s empty in here
      </div>
    {:else}
      <div class="min-h-0 h-full space-y-2 overflow-y-auto">
        {#each selectorEntriesValue as entry (entry.key)}
          <Collapsible.Root
            class="rounded-lg border border-[#4f4a38] bg-[#2d2b25] text-gray-100 group"
            onmouseenter={() => handleSelectorMouseEnter(entry)}
            onmouseleave={handleSelectorMouseLeave}
          >
            <div class="flex w-full items-center gap-2 px-3 py-2 hover:bg-[#37332c]">
              <Collapsible.Trigger class="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span class="w-3 shrink-0 text-center text-2xl text-gray-300 transition-transform duration-200 group-data-[state=open]:rotate-90">
                  ▸
                </span>
                <span class="truncate text-sm text-accent-500">{entry.name}</span>
              </Collapsible.Trigger>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <button
                      {...props}
                      type="button"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-[#464036] hover:text-gray-200"
                      aria-label={`Open actions for ${entry.name}`}
                      onclick={(event) => event.stopPropagation()}
                    >
                      <span class="text-base leading-none">...</span>
                    </button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content class={actionMenuClasses} align="end" side="bottom" sideOffset={6}>
                    <DropdownMenu.Item class={actionMenuItemClasses} onclick={() => handleEditEntry(entry)}>
                      <Pencil class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                      Edit
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

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
  <p class="mt-2 px-1 text-center text-caption text-gray-500 dark:text-gray-400">Updates every script run</p>
</div>
