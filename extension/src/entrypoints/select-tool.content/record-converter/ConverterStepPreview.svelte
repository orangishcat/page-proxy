<script lang="ts">
  import type { ParentTraversalMode, ParentTraversalOption } from "./generate";
  import type { SupportedRecordStep } from "./normalize";

  type Props = {
    activeStep: SupportedRecordStep | null;
    parentOption: ParentTraversalOption | null;
    readonlyStepPreviewCode: string;
    onParentModeChange: (step: SupportedRecordStep, mode: ParentTraversalMode) => void;
    onParentUntilSelectorChange: (step: SupportedRecordStep, untilSelector: string) => void;
    onParentCountChange: (step: SupportedRecordStep, nextCount: string) => void;
  };

  let {
    activeStep,
    parentOption,
    readonlyStepPreviewCode,
    onParentModeChange,
    onParentUntilSelectorChange,
    onParentCountChange,
  }: Props = $props();
</script>

{#if activeStep}
  <div class="border-b border-gray-700 px-4 py-3">
    <h3 class="text-lead">{activeStep.label}</h3>
    {#if activeStep.kind === "select-parent" && parentOption}
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-lg border border-gray-600 bg-gray-900 p-1">
          <button
            type="button"
            class={`rounded-md px-3 py-1 text-caption transition ${
              parentOption.mode === "traverse-until" ? "bg-gray-700 text-white" : "text-gray-300 hover:text-white"
            }`}
            onclick={() => onParentModeChange(activeStep, "traverse-until")}
          >
            Traverse until
          </button>
          <button
            type="button"
            class={`rounded-md px-3 py-1 text-caption transition ${
              parentOption.mode === "traverse-n-times" ? "bg-gray-700 text-white" : "text-gray-300 hover:text-white"
            }`}
            onclick={() => onParentModeChange(activeStep, "traverse-n-times")}
          >
            Traverse n times
          </button>
        </div>

        {#if parentOption.mode === "traverse-until"}
          <label class="flex min-w-0 flex-1 items-center gap-2 text-caption text-gray-300">
            <span>Stop selector</span>
            <input
              class="w-full rounded-md border border-gray-600 bg-gray-950 px-3 py-1 text-caption text-white outline-none transition focus:border-accent-500/70"
              type="text"
              value={parentOption.untilSelector}
              oninput={(event) => onParentUntilSelectorChange(activeStep, event.currentTarget.value)}
            />
          </label>
        {:else}
          <label class="flex items-center gap-2 text-caption text-gray-300">
            <span>n</span>
            <input
              class="w-20 rounded-md border border-gray-600 bg-gray-950 px-3 py-1 text-caption text-white outline-none transition focus:border-accent-500/70"
              type="number"
              min="1"
              value={String(parentOption.count)}
              oninput={(event) => onParentCountChange(activeStep, event.currentTarget.value)}
            />
          </label>
        {/if}
      </div>
    {/if}
  </div>

  <div class="min-h-0 flex-1 p-4">
    <div class="h-full overflow-auto rounded-lg border border-gray-700 bg-gray-950">
      <pre class="min-h-full whitespace-pre-wrap p-4 font-mono text-sm text-gray-100">{readonlyStepPreviewCode}</pre>
    </div>
  </div>
{:else}
  <div class="flex h-full items-center justify-center rounded-lg border border-gray-700 bg-gray-950">
    <p class="text-caption text-gray-400">Select a step to review generated code.</p>
  </div>
{/if}
