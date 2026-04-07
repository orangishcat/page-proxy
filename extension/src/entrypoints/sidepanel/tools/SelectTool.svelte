<script lang="ts">
  import { DropdownMenu, Tooltip } from "bits-ui";
  import Button from "@/lib/components/Button.svelte";
  import {
    sendClickSelection,
    sendCopySelection,
    sendCutSelection,
    sendDeleteSelection,
    sendPasteSelection,
    sendApplyStylePopup,
    sendSelectParent,
    sendUndoLastRecordedAction,
    sendSelectorPopup,
    toggleFollowDevtoolsSelection,
  } from "./select-tool/actions";
  import { recordPanelState } from "./record/state";
  import {
    devtoolsIntegrationDetected,
    followDevtoolsSelection,
    hasSelection,
    propertyItems,
    selectModeEnabled,
  } from "./select-tool/state";
  import { wrenchStateClasses } from "./select-tool/view";
  import {
    ArrowUpIcon,
    ClipboardPaste,
    Copy,
    MousePointerClick,
    Palette,
    Scissors,
    Trash2,
    Undo2,
    Wrench,
  } from "lucide-svelte";
  import { fly } from "svelte/transition";

  const iconActionButtonClass =
    "h-8 w-8 rounded-lg p-0! bg-[#55503E] text-white dark:text-white hover:opacity-55 active:opacity-40";
  const actionMenuClasses =
    "z-20 min-w-56 rounded-md border border-gray-300 bg-gray-50 p-1 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100";
  const actionMenuItemClasses =
    "text-body flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-900/60 dark:active:bg-gray-900";
  const hasRecordedActions = $derived($recordPanelState.timeline.length > 0);
</script>

<div class="flex w-full min-h-0 shrink-0 flex-1 flex-col px-4 py-4">
  <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
    {#if $hasSelection}
      {#key $propertyItems}
        <div
          in:fly={{ y: 16, duration: 300 }}
          class="grid grid-cols-[fit-content(7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-body whitespace-pre-line"
        >
          {#each $propertyItems as prop (prop.key)}
            <span class="min-w-0 text-right truncate text-gray-500">{prop.label}</span>
            <span class="min-w-0 wrap-break-word text-left font-mono">{prop.value}</span>
          {/each}
        </div>
      {/key}
    {:else}
      <div class="text-caption text-gray-500 dark:text-gray-400 flex h-full justify-center place-items-center">
        <div class="flex flex-col items-center gap-2">
          <span>No element selected</span>
          <span>{$selectModeEnabled ? "Esc to cancel select mode" : "⇧+1 to enable select mode"}</span>
        </div>
      </div>
    {/if}
  </div>
  {#if $devtoolsIntegrationDetected && $followDevtoolsSelection}
    <div class="mt-2 text-center text-caption text-gray-500 dark:text-gray-400">
      Currently matching the DevTools panel's selected element
    </div>
  {/if}
  <div class="mt-4 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
    <div class="flex items-center gap-2 justify-self-start">
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class={`${iconActionButtonClass} ${$hasSelection ? "" : "hidden"}`}
              variant="outline"
              aria-label="Select parent element"
              onclick={sendSelectParent}
              disabled={!$hasSelection}
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

      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class={iconActionButtonClass}
              variant="outline"
              aria-label="Undo last recorded action"
              onclick={sendUndoLastRecordedAction}
              disabled={!hasRecordedActions}
            >
              <Undo2 class="h-4 w-4" />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
          >
            Undo last recorded action
            <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
    <div class={`w-full max-w-40 justify-self-center gap-2 ${$hasSelection ? "flex" : "hidden"}`}>
      <Button
        class="flex-1 text-sm"
        variant="primary"
        onclick={() => sendSelectorPopup("pp-api")}
        disabled={!$hasSelection}
      >
        Selector
      </Button>
      <Button
        class="flex-1 text-sm"
        variant="secondary"
        onclick={() => sendSelectorPopup("css")}
        disabled={!$hasSelection}
      >
        CSS
      </Button>
    </div>
    {#if $hasSelection || $devtoolsIntegrationDetected}
      <div class="flex items-center justify-self-end gap-1">
        {#if $hasSelection}
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
                <DropdownMenu.Item class={actionMenuItemClasses} onclick={sendApplyStylePopup}>
                  <Palette class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  Apply style to element
                </DropdownMenu.Item>
                <DropdownMenu.Item class={actionMenuItemClasses} onclick={sendDeleteSelection}>
                  <Trash2 class="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  Delete selected element
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        {/if}

        {#if $devtoolsIntegrationDetected}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  class={`${iconActionButtonClass} ${wrenchStateClasses($followDevtoolsSelection)}`}
                  variant="outline"
                  aria-label="Toggle follow DevTools selected element"
                  aria-pressed={$followDevtoolsSelection}
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
