<script lang="ts">
  import { DropdownMenu, Tooltip } from "bits-ui";
  import { Ban, Check, ChevronDown, Play, Plus } from "lucide-svelte";
  import Button from "@/lib/components/Button.svelte";
  import { shouldShowScriptDropdown, type ScriptSelectionOption } from "./state";

  const actionMenuClasses =
    "z-20 min-w-48 rounded-md border border-gray-300 bg-gray-50 p-1 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100";
  const actionMenuItemClasses =
    "text-body flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-900/60 dark:active:bg-gray-900";

  type Props = {
    scriptTitle: string;
    scriptOptions: ScriptSelectionOption[];
    selectedScriptName: string | null;
    hasUnsavedChanges: boolean;
    isRunning: boolean;
    disableAllGrants: boolean;
    onRun: () => void;
    onDisableGrantToggle: () => void;
    oncreatenewscript: () => void;
    onselectscript: (scriptName: string) => void;
  };

  let {
    scriptTitle,
    scriptOptions,
    selectedScriptName,
    hasUnsavedChanges,
    isRunning,
    disableAllGrants,
    onRun,
    onDisableGrantToggle,
    oncreatenewscript,
    onselectscript,
  }: Props = $props();
</script>

<div class="h-10 w-full bg-[#393a34] flex items-center justify-between px-4">
  <div class="text-body flex min-w-0 items-center gap-1">
    {#if shouldShowScriptDropdown(scriptOptions)}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              class="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left transition hover:bg-white/5"
              aria-label="Select script to edit"
            >
              <span class="truncate">{scriptTitle}</span>
              <ChevronDown class="h-4 w-4 shrink-0 text-gray-400" />
            </button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class={actionMenuClasses} align="start" side="bottom" sideOffset={6}>
            {#each scriptOptions as option (option.scriptName)}
              <DropdownMenu.Item class={actionMenuItemClasses} onclick={() => onselectscript(option.scriptName)}>
                <span class={`truncate ${option.scriptName === selectedScriptName ? "text-accent-500" : ""}`}>
                  {option.scriptName}
                </span>
                {#if option.scriptName === selectedScriptName}
                  <Check class="h-4 w-4 shrink-0 text-accent-500" />
                {/if}
              </DropdownMenu.Item>
            {/each}
            <DropdownMenu.Separator class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
            <DropdownMenu.Item class={actionMenuItemClasses} onclick={oncreatenewscript}>
              <span class="truncate">New script</span>
              <Plus class="h-4 w-4 shrink-0 text-gray-400" />
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    {:else}
      <span>{scriptTitle}</span>
    {/if}
    {#if hasUnsavedChanges}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <div {...props} class="flex items-center gap-2 text-xs text-blue-300">
              <span class="h-2 w-2 rounded-full bg-blue-400"></span>
            </div>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
          >
            Unsaved changes
            <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            class={`px-1! py-1! opacity-100! rounded-lg! hover:bg-gray-400/30 text-xs ${disableAllGrants ? "text-red-400 dark:text-red-300" : "text-gray-500 dark:text-gray-500"}`}
            variant="outline"
            aria-label="Disable all grants"
            aria-pressed={disableAllGrants}
            onclick={onDisableGrantToggle}
          >
            <Ban class="h-4 w-4" />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
        >
          Disable all grants
          <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b] h-8 w-8" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            class="px-3! py-1! text-xs"
            variant="secondary"
            aria-label="Run script"
            onclick={onRun}
            disabled={isRunning}
          >
            <Play class="h-4 w-4" />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
        >
          Run script
          <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </div>
</div>
