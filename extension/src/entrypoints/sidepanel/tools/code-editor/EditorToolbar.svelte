<script lang="ts">
  import { Tooltip } from "bits-ui";
  import { Play } from "lucide-svelte";
  import Button from "@/lib/components/Button.svelte";

  type Props = {
    scriptTitle: string;
    scriptWebsite: string;
    hasUnsavedChanges: boolean;
    isRunning: boolean;
    onrun: () => void;
  };

  let { scriptTitle, scriptWebsite, hasUnsavedChanges, isRunning, onrun }: Props = $props();
</script>

<div class="h-10 w-full bg-[#393a34] flex items-center justify-between px-4">
  <div class="text-body flex gap-1">
    <span>{scriptTitle}</span>
    {#if scriptWebsite}
      <span class="text-gray-600"> @ </span>
      <span class="text-accent-500">{scriptWebsite}</span>
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
  <div class="flex items-center gap-3">
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            class="px-3! py-1! text-xs"
            variant="secondary"
            aria-label="Run script"
            onclick={onrun}
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
