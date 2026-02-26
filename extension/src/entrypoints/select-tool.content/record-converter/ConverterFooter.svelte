<script lang="ts">
  type Props = {
    isReviewStep: boolean;
    canGoPrevious: boolean;
    canGoNext: boolean;
    saveValidationMessage: string;
    saveError: string;
    canSave: boolean;
    isSaving: boolean;
    onCancel: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSave: () => void;
  };

  let {
    isReviewStep,
    canGoPrevious,
    canGoNext,
    saveValidationMessage,
    saveError,
    canSave,
    isSaving,
    onCancel,
    onPrevious,
    onNext,
    onSave,
  }: Props = $props();
</script>

<footer class="border-t border-gray-700 bg-gray-950 px-4 py-3">
  {#if isReviewStep && saveValidationMessage.length > 0}
    <p class="text-caption text-amber-300">{saveValidationMessage}</p>
  {/if}
  {#if isReviewStep && saveError.length > 0}
    <p class="mt-1 text-caption text-red-300">{saveError}</p>
  {/if}

  <div class="mt-3 flex items-center justify-end gap-2">
    <button
      type="button"
      class="rounded-md border border-gray-600 px-4 py-2 text-caption text-gray-200 transition hover:bg-gray-700"
      onclick={onCancel}
    >
      Cancel
    </button>
    <button
      type="button"
      class={`rounded-md border border-gray-600 px-4 py-2 text-caption text-gray-200 transition ${
        canGoPrevious ? "hover:bg-gray-700" : "cursor-not-allowed opacity-60"
      }`}
      disabled={!canGoPrevious || isSaving}
      onclick={onPrevious}
    >
      Previous
    </button>
    <button
      type="button"
      class={`rounded-md px-4 py-2 text-caption font-medium transition ${
        isReviewStep
          ? canSave
            ? "bg-accent-500 text-white hover:bg-accent-400"
            : "cursor-not-allowed bg-gray-700 text-gray-400 opacity-70"
          : canGoNext
            ? "bg-accent-500 text-white hover:bg-accent-400"
            : "cursor-not-allowed bg-gray-700 text-gray-400 opacity-70"
      }`}
      disabled={isReviewStep ? !canSave : !canGoNext}
      onclick={isReviewStep ? onSave : onNext}
    >
      {#if isReviewStep}
        {isSaving ? "Saving..." : "Save"}
      {:else}
        Next
      {/if}
    </button>
  </div>
</footer>
