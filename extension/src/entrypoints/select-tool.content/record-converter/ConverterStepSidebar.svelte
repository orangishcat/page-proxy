<script lang="ts">
  import type { SupportedRecordStep } from "./normalize";

  type Props = {
    isReviewStep: boolean;
    activeStep: SupportedRecordStep | null;
    selectElementCurrentSelector: string;
    selectElementSelectorMatches: string[];
    selectElementMatchCount: number;
    onSelectElementSelectorMatch: (selector: string) => void;
  };

  let {
    isReviewStep,
    activeStep,
    selectElementCurrentSelector,
    selectElementSelectorMatches,
    selectElementMatchCount,
    onSelectElementSelectorMatch,
  }: Props = $props();

  const truncate = (value: string, maxLength = 56) =>
    value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
  const normalizeSelector = (value: string) => value.trim().replace(/\s+/g, " ");
</script>

<aside class="flex w-56 shrink-0 flex-col border-l border-gray-700 bg-gray-950/35 p-4">
  {#if isReviewStep}
    <p class="text-caption text-gray-400">Review the generated code and save when the flow matches your recording.</p>
  {:else if activeStep?.kind === "select-element"}
    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        {#if selectElementSelectorMatches.length === 0}
          <p class="text-caption text-gray-500">No selector matches were generated for the selected element.</p>
        {:else}
          <div class="space-y-2">
            {#each selectElementSelectorMatches as selectorMatch, selectorIndex (`${selectorMatch}-${selectorIndex}`)}
              {@const isSelected = normalizeSelector(selectorMatch) === normalizeSelector(selectElementCurrentSelector)}
              <button
                type="button"
                class="w-full cursor-pointer bg-transparent px-0 py-1 text-left transition truncate"
                onclick={() => onSelectElementSelectorMatch(selectorMatch)}
                title={selectorMatch}
              >
                <span
                  class={`font-mono text-xs ${
                    isSelected ? "text-accent-400" : "text-gray-400 hover:text-accent-400"
                  }`}>{truncate(selectorMatch)}</span
                >
              </button>
            {/each}
          </div>
        {/if}
    </div>
  {:else}
    <p class="text-caption text-gray-400">Select a step to inspect step-specific options.</p>
  {/if}

  {#if !isReviewStep && activeStep?.kind === "select-element"}
    <div class="pt-3 text-caption text-gray-400">
      Hold <code>z</code> to highlight {selectElementMatchCount} matching element{selectElementMatchCount === 1
        ? ""
        : "s"}.
    </div>
  {/if}
</aside>
