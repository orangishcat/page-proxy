<script lang="ts">
  import type { SupportedRecordStep } from "./normalize";

  type Props = {
    supportedSteps: SupportedRecordStep[];
    skippedCount: number;
    activeStepId: string;
    reviewStepId: string;
    onStepSelect: (stepId: string) => void;
  };

  let { supportedSteps, skippedCount, activeStepId, reviewStepId, onStepSelect }: Props = $props();
</script>

<aside class="flex w-72 shrink-0 flex-col border-r border-gray-700 bg-gray-950">
  <div class="border-b border-gray-700 px-4 py-3">
    <p class="text-caption text-gray-300">Supported steps: {supportedSteps.length}</p>
    {#if skippedCount > 0}
      <p class="mt-1 text-caption text-amber-300">Skipped unsupported steps: {skippedCount}</p>
    {/if}
  </div>
  <ol class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
    {#each supportedSteps as step, index (step.id)}
      <li>
        <button
          type="button"
          class={`w-full rounded-lg border px-3 py-2 text-left transition ${
            activeStepId === step.id
              ? "border-accent-500/60 bg-accent-500/15 text-white"
              : "border-transparent text-gray-300 hover:border-accent-500/40 hover:bg-accent-500/10 hover:text-white"
          }`}
          onclick={() => onStepSelect(step.id)}
        >
          <p class="text-caption text-gray-400">Step {index + 1}</p>
          <p class="text-body">{step.label}</p>
        </button>
      </li>
    {/each}
    <li>
      <button
        type="button"
        class={`w-full rounded-lg border px-3 py-2 text-left transition ${
          activeStepId === reviewStepId
            ? "border-accent-500/60 bg-accent-500/15 text-white"
            : "border-transparent text-gray-300 hover:border-accent-500/40 hover:bg-accent-500/10 hover:text-white"
        }`}
        onclick={() => onStepSelect(reviewStepId)}
      >
        <p class="text-caption text-gray-400">Final step</p>
        <p class="text-body">Review</p>
      </button>
    </li>
  </ol>
</aside>
