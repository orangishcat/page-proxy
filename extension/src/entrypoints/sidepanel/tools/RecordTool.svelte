<script lang="ts">
  import { Tooltip } from "bits-ui";
  import { onMount, tick } from "svelte";
  import { CheckCheck, Disc, Trash2, X } from "lucide-svelte";

  import Button from "@/lib/components/Button.svelte";
  import { openRecordConverter } from "./record/actions";
  import { getRecordTimelineEntryIds, hasFullRecordSelection } from "./record/selection";
  import {
    clearRecordPanelState,
    prepareRecordToolForDisplay,
    recordPanelState,
    toggleRecordPanelRecording,
  } from "./record/state";
  import type { RecordTimelineEntry } from "./storage/record-panel";

  const recordState = $derived($recordPanelState);
  let timelineContainer = $state<HTMLDivElement | null>(null);
  let selectedEntryIds = $state<string[]>([]);
  let dragSelectionMode = $state<"none" | "replace" | "toggle">("none");
  let dragVisitedEntryIds = $state<string[]>([]);

  const timelineEntries = $derived(recordState.timeline);
  const isRecording = $derived(recordState.isRecording);
  const allEntryIds = $derived(getRecordTimelineEntryIds(timelineEntries));
  const selectedEntryIdSet = $derived(new Set(selectedEntryIds));
  const selectedEntries = $derived.by(() => {
    return timelineEntries.filter((entry) => selectedEntryIdSet.has(entry.id));
  });
  const hasSelectedEntries = $derived(selectedEntries.length > 0);
  const allEntriesSelected = $derived(hasFullRecordSelection(timelineEntries, selectedEntryIds));

  $effect(() => {
    const timelineIdSet = new Set(recordState.timeline.map((entry) => entry.id));
    const prunedSelection = selectedEntryIds.filter((id) => timelineIdSet.has(id));
    if (prunedSelection.length !== selectedEntryIds.length) {
      selectedEntryIds = prunedSelection;
    }
  });

  const scrollTimelineToBottom = () => {
    if (!timelineContainer) {
      return;
    }

    timelineContainer.scrollTop = timelineContainer.scrollHeight;
  };

  onMount(() => {
    void prepareRecordToolForDisplay().finally(() => tick().then(scrollTimelineToBottom));

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (dragSelectionMode === "none") {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        endDragSelection();
        return;
      }

      const hoveredElement = document.elementFromPoint(event.clientX, event.clientY);
      if (!(hoveredElement instanceof Element)) {
        return;
      }

      const targetWithId = hoveredElement.closest("[data-record-entry-id]");
      if (!(targetWithId instanceof HTMLElement)) {
        return;
      }

      const entryId = targetWithId.dataset.recordEntryId;
      if (!entryId || dragVisitedEntryIds.includes(entryId)) {
        return;
      }

      dragVisitedEntryIds = [...dragVisitedEntryIds, entryId];
      if (dragSelectionMode === "toggle") {
        toggleEntrySelection(entryId);
        return;
      }

      if (!isEntrySelected(entryId)) {
        selectedEntryIds = [...selectedEntryIds, entryId];
      }
    };

    const handleWindowPointerUp = () => {
      endDragSelection();
    };
    const handleWindowBlur = () => {
      endDragSelection();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  });

  const formatTimestamp = (value: number) =>
    new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const getEntryDetail = (entry: RecordTimelineEntry) => {
    const normalized = entry.detail.trim();
    return normalized.length > 0 ? normalized : null;
  };
  const isSelectedElementEntry = (entry: RecordTimelineEntry) =>
    entry.action.trim().toLowerCase() === "selected element";

  const isModifierHeld = (event: MouseEvent | PointerEvent | KeyboardEvent) => event.metaKey || event.ctrlKey;

  const isEntrySelected = (entryId: string) => selectedEntryIdSet.has(entryId);

  const toggleEntrySelection = (entryId: string) => {
    selectedEntryIds = isEntrySelected(entryId)
      ? selectedEntryIds.filter((id) => id !== entryId)
      : [...selectedEntryIds, entryId];
  };

  const clearSelection = () => {
    selectedEntryIds = [];
  };

  const selectAllEntries = () => {
    selectedEntryIds = allEntryIds;
  };

  const endDragSelection = () => {
    dragSelectionMode = "none";
    dragVisitedEntryIds = [];
  };

  const beginDragSelection = (entryId: string, mode: "replace" | "toggle") => {
    dragSelectionMode = mode;
    dragVisitedEntryIds = [entryId];
    if (mode === "toggle") {
      toggleEntrySelection(entryId);
      return;
    }
    selectedEntryIds = [entryId];
  };

  const handleEntryPointerDown = (event: PointerEvent, entryId: string) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    if (isModifierHeld(event)) {
      beginDragSelection(entryId, "toggle");
      return;
    }

    beginDragSelection(entryId, "replace");
  };

  const handleEntryKeyDown = (event: KeyboardEvent, entryId: string) => {
    if ((event.key === "Enter" || event.key === " ") && isModifierHeld(event)) {
      event.preventDefault();
      toggleEntrySelection(entryId);
    }
  };

  const convertSelectionToCode = () => {
    if (!hasSelectedEntries) {
      return;
    }

    openRecordConverter(selectedEntries);
  };

  const iconTooltipClass =
    "rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100";
</script>

<div class="flex w-full min-h-0 flex-1 flex-col px-4 py-4">
  <div class="min-h-0 flex-1 overflow-y-auto pr-1" bind:this={timelineContainer}>
    {#if timelineEntries.length === 0}
      <div class="flex h-full items-center justify-center text-caption text-gray-500 dark:text-gray-400">
        {#if isRecording}
          No actions recorded for this tab yet
        {:else}
          Recording is paused for this tab
        {/if}
      </div>
    {:else}
      <div>
        <ul>
          {#each timelineEntries as entry (entry.id)}
            {@const entryDetail = getEntryDetail(entry)}
            {@const shouldTruncateDetail = isSelectedElementEntry(entry)}
            <li class="min-w-0">
              <button
                data-record-entry-id={entry.id}
                class={`w-full rounded-xl border px-1.5 py-1 text-left transition ${
                  isEntrySelected(entry.id)
                    ? "border-accent-500/40 bg-accent-500/10"
                    : "border-transparent bg-transparent hover:border-accent-500/30 hover:bg-accent-500/10"
                }`}
                type="button"
                aria-pressed={isEntrySelected(entry.id)}
                onpointerdown={(event) => handleEntryPointerDown(event, entry.id)}
                onkeydown={(event) => handleEntryKeyDown(event, entry.id)}
              >
                <div class="flex items-start justify-between gap-3">
                  <span class="min-w-0 text-body text-gray-800 dark:text-gray-100">{entry.action}</span>
                  <span class="shrink-0 text-caption text-gray-500 dark:text-gray-400">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                {#if entryDetail}
                  <p
                    class={`mt-1 text-caption text-gray-600 dark:text-gray-400 ${shouldTruncateDetail ? "truncate" : ""}`}
                    title={shouldTruncateDetail ? entryDetail : null}
                  >
                    {entryDetail}
                  </p>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <div class="mt-4 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
    {#if hasSelectedEntries}
      <span class="justify-self-start text-caption text-gray-500 dark:text-gray-400">
        {selectedEntries.length} selected
      </span>
      <Button class="w-full max-w-40 justify-self-center text-sm" variant="primary" onclick={convertSelectionToCode}>
        Convert to code
      </Button>
      <div class="flex items-center justify-self-end gap-2">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class="h-8 w-8 rounded-lg border border-gray-700 bg-transparent p-0! text-gray-500 hover:text-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                variant="outline"
                aria-label="Select all events"
                disabled={allEntriesSelected}
                onclick={selectAllEntries}
              >
                <CheckCheck class="h-4 w-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content sideOffset={6} class={iconTooltipClass}>
              Select all events
              <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Button
          class="h-8 w-8 rounded-lg border border-gray-700 bg-transparent p-0! text-gray-500 hover:text-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          variant="outline"
          aria-label="Clear selection"
          onclick={clearSelection}
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    {:else}
      <div class="flex items-center gap-2">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class={`h-8 w-8 rounded-full p-0! ${
                  isRecording
                    ? "border-red-400! bg-red-500/85! text-red-50 hover:opacity-100"
                    : "border-gray-700 bg-gray-700 text-gray-200"
                }`}
                variant="outline"
                aria-label={isRecording ? "Stop recording" : "Start recording"}
                aria-pressed={isRecording}
                onclick={toggleRecordPanelRecording}
              >
                <Disc class="h-4 w-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content sideOffset={6} class={iconTooltipClass}>
              {isRecording ? "Stop recording" : "Start recording"}
              <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <span class={`text-caption ${isRecording ? "text-red-300" : "text-gray-500 dark:text-gray-400"}`}>
          {isRecording ? "Recording" : "Paused"}
        </span>
      </div>
      <span class="justify-self-center text-caption text-gray-500 dark:text-gray-400"
        >{timelineEntries.length} events</span
      >
      <div class="flex items-center justify-self-end gap-2">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class="h-8 w-8 rounded-lg border border-gray-700 bg-transparent p-0! text-gray-500 hover:text-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                variant="outline"
                aria-label="Select all events"
                disabled={timelineEntries.length === 0}
                onclick={selectAllEntries}
              >
                <CheckCheck class="h-4 w-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content sideOffset={6} class={iconTooltipClass}>
              Select all events
              <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                class="h-8 w-8 rounded-lg border border-gray-700 bg-transparent p-0! text-gray-500 hover:text-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                variant="outline"
                aria-label="Delete recording"
                onclick={clearRecordPanelState}
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content sideOffset={6} class={iconTooltipClass}>
              Delete recording
              <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    {/if}
  </div>
</div>
