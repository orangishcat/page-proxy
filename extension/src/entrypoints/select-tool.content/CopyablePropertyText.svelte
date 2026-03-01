<script lang="ts">
  import { Tooltip } from "bits-ui";

  type Props = {
    text: string;
    displayText?: string;
    title?: string;
    align?: "left" | "right";
    class?: string;
    stopPropagation?: boolean;
  };

  let {
    text,
    displayText = text,
    title = text,
    align = "right",
    class: className = "",
    stopPropagation = false,
  }: Props = $props();

  let copied = $state(false);
  let copyResetToken = 0;

  const copyText = (value: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000em";
    textarea.style.left = "-1000em";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copiedSuccessfully = document.execCommand("copy");
    textarea.remove();
    return copiedSuccessfully;
  };

  const handleCopy = (event: MouseEvent) => {
    if (stopPropagation) {
      event.stopPropagation();
    }

    copied = copyText(text);
    if (!copied) {
      return;
    }

    const token = ++copyResetToken;
    window.setTimeout(() => {
      if (token === copyResetToken) {
        copied = false;
      }
    }, 1200);
  };
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <div
        {...props}
        title={title}
        onclick={handleCopy}
        class={`font-mono text-xs truncate transition-colors underline-offset-2 decoration-accent-400/80 hover:text-accent-300 hover:underline cursor-pointer ${align === "right" ? "text-right" : "text-left"} ${className}`}
      >
        {displayText}
      </div>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content
      sideOffset={6}
      class="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-caption text-gray-100 shadow-lg"
    >
      {copied ? "Copied!" : "click to copy"}
      <Tooltip.Arrow class="fill-gray-900" />
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>
