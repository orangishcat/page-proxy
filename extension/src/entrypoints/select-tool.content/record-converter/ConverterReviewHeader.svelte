<script lang="ts">
  import type { ReviewCodeMode } from "./generate";

  type Props = {
    renameMap: Record<string, string>;
    mode: ReviewCodeMode;
    onModeChange: (mode: ReviewCodeMode) => void;
    onReset: () => void;
  };

  let { renameMap, mode, onModeChange, onReset }: Props = $props();

  const reviewModeOptions: Array<{ value: ReviewCodeMode; label: string }> = [
    { value: "combined", label: "Combined code" },
    { value: "functions", label: "Functions" },
  ];
</script>

<div class="border-b border-gray-700 px-4 py-3">
  <div class="flex flex-wrap items-center gap-3">
    <div>
      <h3 class="text-lead">Review generated code</h3>
      <p class="text-caption text-gray-300">Edit as needed before saving.</p>
    </div>
    <div class="flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800/70 p-1">
      {#each reviewModeOptions as option (option.value)}
        <button
          type="button"
          class="rounded-sm px-2 py-1 text-caption transition"
          class:bg-gray-600={mode === option.value}
          class:text-white={mode === option.value}
          class:text-gray-200={mode !== option.value}
          class:hover:bg-gray-700={mode !== option.value}
          onclick={() => onModeChange(option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
    <div class="flex-1"></div>
    <button
      type="button"
      class="rounded-md border border-gray-600 px-3 py-1 text-caption text-gray-200 transition hover:bg-gray-700"
      onclick={onReset}
    >
      Reset to generated
    </button>
  </div>
  {#if Object.keys(renameMap).length > 0}
    <p class="mt-2 text-caption text-amber-300">
      Collision rename map:
      {Object.entries(renameMap)
        .map(([from, to]) => `${from} → ${to}`)
        .join(", ")}
    </p>
  {/if}
</div>
