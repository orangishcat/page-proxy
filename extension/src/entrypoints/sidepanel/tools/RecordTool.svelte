<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { Disc, Trash2 } from "lucide-svelte";

  import Button from "@/lib/components/Button.svelte";
  import { clearRecordPanelState, recordPanelState, toggleRecordPanelRecording } from "./record/state";
  import type { RecordPanelState, RecordTimelineEntry } from "./state-storage";

  let recordState = $state<RecordPanelState>({
    isRecording: true,
    timeline: [],
    updatedAt: Date.now(),
  });
  let timelineContainer = $state<HTMLDivElement | null>(null);

  const timelineEntries = $derived(recordState.timeline);
  const isRecording = $derived(recordState.isRecording);

  const unsubscribeRecordPanelState = recordPanelState.subscribe((value) => {
    recordState = value;
  });

  onDestroy(() => {
    unsubscribeRecordPanelState();
  });

  const scrollTimelineToBottom = () => {
    if (!timelineContainer) {
      return;
    }

    timelineContainer.scrollTop = timelineContainer.scrollHeight;
  };

  onMount(() => {
    void tick().then(scrollTimelineToBottom);
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
      <div class="relative pl-6">
        <div
          class="pointer-events-none absolute bottom-1 left-[0.4em] top-1 w-px bg-[#d5d0c0] dark:bg-[#4f4a38]"
          aria-hidden="true"
        ></div>
        <ul class="space-y-4">
          {#each timelineEntries as entry (entry.id)}
            <li class="relative min-w-0">
              <div class="min-w-0">
                <div class="flex items-start justify-between gap-3">
                  <span class="min-w-0 text-body text-gray-800 dark:text-gray-100">{entry.action}</span>
                  <span class="shrink-0 text-caption text-gray-500 dark:text-gray-400">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                {#if getEntryDetail(entry)}
                  <p class="mt-1 text-caption text-gray-600 dark:text-gray-400">{entry.detail}</p>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <div class="mt-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <Button
        class={`h-8 w-8 rounded-full p-0! ${
          isRecording
            ? "!border-red-400 !bg-red-500/85 text-red-50 hover:opacity-100"
            : "border-[#5b5542] bg-[#55503E] text-gray-200"
        }`}
        variant="outline"
        aria-label={isRecording ? "Pause recording" : "Resume recording"}
        aria-pressed={isRecording}
        onclick={toggleRecordPanelRecording}
      >
        <Disc class="h-4 w-4" />
      </Button>
      <span class={`text-caption ${isRecording ? "text-red-300" : "text-gray-500 dark:text-gray-400"}`}>
        {isRecording ? "Recording" : "Paused"}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-caption text-gray-500 dark:text-gray-400">{timelineEntries.length} events</span>
      <Button
        class="h-8 w-8 rounded-lg border border-[#5b5542] bg-transparent p-0! text-gray-500 hover:text-gray-300 dark:border-[#4f4a38] dark:text-gray-400 dark:hover:text-gray-200"
        variant="outline"
        aria-label="Clear recording storage"
        onclick={clearRecordPanelState}
      >
        <Trash2 class="h-4 w-4" />
      </Button>
    </div>
  </div>
</div>
