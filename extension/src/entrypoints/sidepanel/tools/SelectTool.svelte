<script lang="ts">
  import { onDestroy } from "svelte";
  import { DropdownMenu, Tooltip } from "bits-ui";
  import Button from "@/lib/components/Button.svelte";
  import type { PropertyItem } from "./select-tool/state";
  import {
    sendClickSelection,
    sendCopySelection,
    sendCutSelection,
    sendDeleteSelection,
    sendPasteSelection,
    sendSelectParent,
    sendSelectorPopup,
    toggleFollowDevtoolsSelection,
  } from "./select-tool/actions";
  import {
    devtoolsIntegrationDetected,
    followDevtoolsSelection,
    hasSelection,
    propertyItems,
    selectModeEnabled,
  } from "./select-tool/state";
  import { ArrowUpIcon, ClipboardPaste, Copy, MousePointerClick, Scissors, Trash2, Wrench } from "lucide-svelte";
  import { fly } from "svelte/transition";

  const iconActionButtonClass =
    "h-8 w-8 rounded-lg p-0! bg-[#55503E] text-white dark:text-white hover:opacity-55 active:opacity-40";
  const actionMenuClasses =
    "z-20 min-w-56 rounded-md border border-gray-300 bg-gray-50 p-1 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100";
  const actionMenuItemClasses =
    "text-body flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-900/60 dark:active:bg-gray-900";

  let hasSelectionValue = $state(false);
  let selectModeEnabledValue = $state(false);
  let devtoolsIntegrationDetectedValue = $state(false);
  let followDevtoolsSelectionValue = $state(false);
  let propertyItemsValue = $state<PropertyItem[]>([]);

  const unsubscribeHasSelection = hasSelection.subscribe((value) => {
    hasSelectionValue = value;
  });
  const unsubscribeSelectModeEnabled = selectModeEnabled.subscribe((value) => {
    selectModeEnabledValue = value;
  });
  const unsubscribeDevtoolsIntegrationDetected = devtoolsIntegrationDetected.subscribe((value) => {
    devtoolsIntegrationDetectedValue = value;
  });
  const unsubscribeFollowDevtoolsSelection = followDevtoolsSelection.subscribe((value) => {
    followDevtoolsSelectionValue = value;
  });
  const unsubscribePropertyItems = propertyItems.subscribe((value) => {
    propertyItemsValue = value;
  });

  onDestroy(() => {
    unsubscribeHasSelection();
    unsubscribeSelectModeEnabled();
    unsubscribeDevtoolsIntegrationDetected();
    unsubscribeFollowDevtoolsSelection();
    unsubscribePropertyItems();
  });
</script>

<div class="flex w-full min-h-0 shrink-0 flex-1 flex-col px-4 py-4">
  <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
    {#if hasSelectionValue}
      {#key propertyItemsValue}
        <div
          in:fly={{ y: 16, duration: 300 }}
          class="grid grid-cols-[fit-content(7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-body whitespace-pre-line"
        >
          {#each propertyItemsValue as prop (prop.key)}
            <span class="min-w-0 text-right truncate text-gray-500">{prop.label}</span>
            <span class="min-w-0 wrap-break-word text-left font-mono">{prop.value}</span>
          {/each}
        </div>
      {/key}
    {:else}
      <div class="text-caption text-gray-500 dark:text-gray-400 flex h-full justify-center place-items-center">
        <div class="flex flex-col items-center gap-2">
          <span>No element selected</span>
          <span>{selectModeEnabledValue ? "Esc to cancel select mode" : "⇧+1 to enable select mode"}</span>
        </div>
      </div>
    {/if}
  </div>
  {#if devtoolsIntegrationDetectedValue && followDevtoolsSelectionValue}
    <div class="mt-2 text-center text-caption text-gray-500 dark:text-gray-400">
      Currently matching the DevTools panel's selected element
    </div>
  {/if}
  <div class="mt-4 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            class={`${iconActionButtonClass} ${hasSelectionValue ? "" : "hidden"}`}
            variant="outline"
            aria-label="Select parent element"
            onclick={sendSelectParent}
            disabled={!hasSelectionValue}
          >
            <ArrowUpIcon class="h-5 w-5" />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
        >
          Select parent element
          <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
    <div class={`w-full max-w-40 justify-self-center gap-2 ${hasSelectionValue ? "flex" : "hidden"}`}>
      <Button
        class="flex-1 text-sm"
        variant="primary"
        onclick={() => sendSelectorPopup("pp-api")}
        disabled={!hasSelectionValue}
      >
        Selector
      </Button>
      <Button
        class="flex-1 text-sm"
        variant="secondary"
        onclick={() => sendSelectorPopup("css")}
        disabled={!hasSelectionValue}
      >
        CSS
      </Button>
    </div>
    {#if hasSelectionValue || devtoolsIntegrationDetectedValue}
      <div class="flex items-center justify-self-end gap-1">
        {#if hasSelectionValue}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  class={iconActionButtonClass}
                  variant="outline"
                  aria-label="Selected element actions"
                >
                  <span class="text-lg leading-none">...</span>
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content class={actionMenuClasses} align="end" side="top" sideOffset={6}>
                <DropdownMenu.Item class={actionMenuItemClasses} onclick={sendClickSelection}>
                  <MousePointerClick class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  Click selected element
                </DropdownMenu.Item>
                <DropdownMenu.Item class={actionMenuItemClasses} onclick={sendCopySelection}>
                  <Copy class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  Copy selected element
                </DropdownMenu.Item>
                <DropdownMenu.Item class={actionMenuItemClasses} onclick={sendCutSelection}>
                  <Scissors class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  Cut selected element
                </DropdownMenu.Item>
                <DropdownMenu.Item class={actionMenuItemClasses} onclick={sendPasteSelection}>
                  <ClipboardPaste class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  Paste after selected element
                </DropdownMenu.Item>
                <DropdownMenu.Item class={actionMenuItemClasses} onclick={sendDeleteSelection}>
                  <Trash2 class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  Delete selected element
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        {/if}

        {#if devtoolsIntegrationDetectedValue}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  class={`${iconActionButtonClass} ${followDevtoolsSelectionValue ? "text-accent-500 opacity-100" : "opacity-55 hover:opacity-80"}`}
                  variant="outline"
                  aria-label="Toggle follow DevTools selected element"
                  aria-pressed={followDevtoolsSelectionValue}
                  onclick={toggleFollowDevtoolsSelection}
                >
                  <Wrench class="h-4 w-4" />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                sideOffset={6}
                class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
              >
                Follow DevTools selected element
                <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        {/if}
      </div>
    {/if}
  </div>
</div>
