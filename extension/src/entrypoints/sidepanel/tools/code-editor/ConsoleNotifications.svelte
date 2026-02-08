<script lang="ts">
  import type { ScriptRunLogEntry, ScriptRunLogLevel } from "@/lib/script-runner";
  import ConsoleObjectViewer from "./ConsoleObjectViewer.svelte";

  export type ConsoleNotification = {
    id: string;
    log: ScriptRunLogEntry;
  };

  type Props = {
    notifications: ConsoleNotification[];
    onDismiss: (id: string) => void;
  };

  let { notifications, onDismiss }: Props = $props();

  const levelClassMap: Record<ScriptRunLogLevel, string> = {
    log: "border-[#6f725f] bg-[#2a2b24] text-[#e8eadf]",
    info: "border-[#4c6681] bg-[#1f2a34] text-[#d9ecff]",
    warn: "border-[#8a6a2b] bg-[#302814] text-[#ffe8b6]",
    error: "border-[#8b3f44] bg-[#321d20] text-[#ffd8d8]",
    debug: "border-[#5e587d] bg-[#252338] text-[#e1ddff]",
    notification: "border-[#4a7c63] bg-[#1f3128] text-[#d7ffea]",
  };

  const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleTimeString();
</script>

{#if notifications.length > 0}
  <div class="pointer-events-none absolute right-2 top-10 z-20 flex max-h-[45%] w-[90%] max-w-[24rem] flex-col gap-2 overflow-y-auto">
    {#each notifications as notification (notification.id)}
      <div class={`pointer-events-auto rounded-md border px-2 py-2 text-xs shadow-lg ${levelClassMap[notification.log.level]}`}>
        <div class="mb-1 flex items-center justify-between gap-2">
          <div class="font-semibold uppercase tracking-wide">
            {notification.log.level === "notification" ? "notification" : `console.${notification.log.level}`}
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[0.625rem] opacity-80">{formatTimestamp(notification.log.timestamp)}</span>
            <button
              type="button"
              class="rounded px-1 text-[0.625rem] opacity-80 hover:bg-white/10 hover:opacity-100"
              onclick={() => onDismiss(notification.id)}
              aria-label="Dismiss console notification"
            >
              ×
            </button>
          </div>
        </div>

        {#if notification.log.values.length === 0}
          <div class="font-mono text-[0.6875rem] opacity-90">(no arguments)</div>
        {:else}
          <div class="flex flex-col gap-1 font-mono text-[0.6875rem] leading-5">
            {#each notification.log.values as value, index (`${notification.id}-${index}`)}
              <ConsoleObjectViewer value={value} propertyName={notification.log.values.length > 1 ? `arg${index}` : undefined} />
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
