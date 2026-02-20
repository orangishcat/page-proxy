<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { CssSelectorPart } from "./css-inspector";

  type PropertyItem = {
    key: string;
    value: string;
  };

  type Props = {
    activeCssPart: CssSelectorPart | null;
    propertyItems: PropertyItem[];
    hasNthOfTypeRule: boolean;
    isCssEditorFocused: boolean;
    cssPreviewErrorMessage: string | null;
    onRemoveNthOfType: () => void;
  };

  let { activeCssPart, propertyItems, hasNthOfTypeRule, isCssEditorFocused, cssPreviewErrorMessage, onRemoveNthOfType }: Props =
    $props();

  const truncate = (val: string, max: number) => (val.length > max ? `${val.slice(0, max)}…` : val);
</script>

<div class="flex-1 min-h-0 flex flex-col gap-3">
  {#if activeCssPart}
    <div class="space-y-1">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs uppercase tracking-wide text-gray-500">{activeCssPart.type}</span>
        <span class="font-mono text-xs text-accent-400 break-all">{activeCssPart.displayText}</span>
      </div>
      <p class="h-14 text-xs leading-5 text-gray-400">{activeCssPart.description}</p>
    </div>
  {:else}
    <div class="h-14 text-xs leading-5 text-gray-500">
      Place the text caret on a selector part to inspect it.
    </div>
  {/if}

  <div class="text-xs uppercase tracking-wide text-gray-500">Properties</div>
  <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
    <div class="flex flex-col gap-2">
      {#each propertyItems as item (item.key)}
        <div class="flex justify-between items-center rounded-md border border-transparent px-2 py-1 hover:bg-white/10">
          <div class="font-mono text-xs text-accent-500 truncate max-w-24">
            {item.key}
          </div>
          {#if item.value.length > 18}
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <div
                    {...props}
                    title={item.value}
                    class="font-mono text-xs text-secondary-500 truncate text-right underline cursor-help"
                  >
                    {item.value.length} chars
                  </div>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  sideOffset={6}
                  class="max-w-96 break-all rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-caption text-gray-100 shadow-lg"
                >
                  {item.value}
                  <Tooltip.Arrow class="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          {:else}
            <div class="font-mono text-xs text-secondary-500 truncate text-right">
              {truncate(item.value, 30)}
            </div>
          {/if}
        </div>
      {/each}
      {#if propertyItems.length === 0}
        <div class="text-xs text-gray-500 text-center p-2">No properties available.</div>
      {/if}
    </div>
  </div>
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
    <p class="text-sm text-red-400">{cssPreviewErrorMessage}</p>
  {/if}
</div>
