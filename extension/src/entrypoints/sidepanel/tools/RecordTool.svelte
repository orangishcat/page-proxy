<script lang="ts">
  import { onDestroy } from "svelte";
  import { Disc } from "lucide-svelte";

  import Button from "@/lib/components/Button.svelte";
  import { recordPanelState, toggleRecordPanelRecording } from "./record/state";
  import type { RecordPanelState, RecordTimelineEntry } from "./state-storage";

  let recordState = $state<RecordPanelState>({
    isRecording: true,
    timeline: [],
    updatedAt: Date.now(),
  });

  const timelineEntries = $derived(recordState.timeline);
  const isRecording = $derived(recordState.isRecording);

  const unsubscribeRecordPanelState = recordPanelState.subscribe((value) => {
    recordState = value;
  });

  onDestroy(() => {
    unsubscribeRecordPanelState();
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
  <div class="min-h-0 flex-1 overflow-y-auto pr-1">
    {#if timelineEntries.length === 0}
      <div class="flex h-full items-center justify-center text-caption text-gray-500 dark:text-gray-400">
        {#if isRecording}
          No actions recorded for this tab yet
        {:else}
          Recording is paused for this tab
        {/if}
      </div>
    {:else}
      <ul class="space-y-2">
        {#each timelineEntries as entry (entry.id)}
          <li class="rounded-lg border border-[#4f4a38] bg-[#2d2b25] px-3 py-2">
            <div class="flex items-start justify-between gap-3">
              <span class="text-body text-gray-100">{entry.action}</span>
              <span class="shrink-0 text-caption text-gray-500">{formatTimestamp(entry.timestamp)}</span>
            </div>
            {#if getEntryDetail(entry)}
              <p class="mt-1 text-caption text-gray-400">{entry.detail}</p>
            {/if}
          </li>
        {/each}
      </ul>
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
    <span class="text-caption text-gray-500 dark:text-gray-400">{timelineEntries.length} events</span>
  </div>
</div>
