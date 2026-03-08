<script lang="ts">
  import type { SidepanelMessage } from "./tool-errors";
  import Banner from "../banners/Banner.svelte";
  import StackTraceView from "./StackTraceView.svelte";

  type Props = {
    message: SidepanelMessage;
    dismissAriaLabel?: string;
    onDismiss: () => void;
  };

  let {
    message,
    dismissAriaLabel = "Dismiss status message",
    onDismiss,
  }: Props = $props();

  const variant = $derived(message.status === "success" ? "success" : "error");
</script>

<Banner {variant} {dismissAriaLabel} onDismiss={onDismiss}>
  {#if message.status === "success"}
    <span>{message.text}</span>
  {:else}
    <div class="w-full">
      <span>{message.text}</span>
      {#if message.stackTrace}
        <StackTraceView stackTrace={message.stackTrace} />
      {/if}
    </div>
  {/if}
</Banner>
