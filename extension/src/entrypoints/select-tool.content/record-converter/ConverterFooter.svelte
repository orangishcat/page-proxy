<script lang="ts">
  type Props = {
    saveValidationMessage: string;
    saveError: string;
    canSave: boolean;
    isSaving: boolean;
    onCancel: () => void;
    onSave: () => void;
  };

  let { saveValidationMessage, saveError, canSave, isSaving, onCancel, onSave }: Props = $props();
</script>

<footer class="border-t border-gray-700 bg-gray-950 px-4 py-3">
  {#if saveValidationMessage.length > 0}
    <p class="text-caption text-amber-300">{saveValidationMessage}</p>
  {/if}
  {#if saveError.length > 0}
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
      class={`rounded-md px-4 py-2 text-caption font-medium transition ${
        canSave ? "bg-accent-500 text-white hover:bg-accent-400" : "cursor-not-allowed bg-gray-700 text-gray-400 opacity-70"
      }`}
      disabled={!canSave}
      onclick={onSave}
    >
      {isSaving ? "Saving..." : "Save"}
    </button>
  </div>
</footer>
