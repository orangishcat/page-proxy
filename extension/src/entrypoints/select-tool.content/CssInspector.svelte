<script lang="ts">
  import type { CssSelectorPart } from "./css-inspector";

  type Props = {
    activeCssPart: CssSelectorPart | null;
    hasNthOfTypeRule: boolean;
    isCssEditorFocused: boolean;
    cssPreviewErrorMessage: string | null;
    onRemoveNthOfType: () => void;
  };

  let { activeCssPart, hasNthOfTypeRule, isCssEditorFocused, cssPreviewErrorMessage, onRemoveNthOfType }: Props =
    $props();
</script>

<div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-2">
  {#if activeCssPart}
    <div class="space-y-[0.25em]">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[0.7em] uppercase tracking-wide text-gray-500">{activeCssPart.type}</span>
        <span class="font-mono text-[0.8em] text-accent-400 break-all">{activeCssPart.displayText}</span>
      </div>
      <p class="text-[0.8em] text-gray-400">{activeCssPart.description}</p>
    </div>
  {:else}
    <div class="text-[0.8em] text-gray-500">Place the text caret on a selector part to inspect it.</div>
  {/if}
</div>
<div class="mt-auto space-y-4">
  {#if hasNthOfTypeRule}
    <p class="text-xs text-gray-500">
      Want to broaden the selector?
      <button
        type="button"
        class="ml-1 cursor-pointer bg-transparent p-0 text-accent-400 underline decoration-accent-400/80 underline-offset-2 transition hover:text-accent-300"
        onclick={onRemoveNthOfType}
      >
        Remove nth-of-type
      </button>
    </p>
  {/if}
  <p class="text-xs text-gray-500">
    Hold alt/option to highlight matching elements{isCssEditorFocused ? " (unfocus code editor first)" : ""}
  </p>
  {#if cssPreviewErrorMessage}
    <p class="text-[0.875em] text-red-400">{cssPreviewErrorMessage}</p>
  {/if}
</div>
