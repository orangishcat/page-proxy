<script lang="ts">
  type Props = {
    renameMap: Record<string, string>;
    onReset: () => void;
  };

  let { renameMap, onReset }: Props = $props();
</script>

<div class="border-b border-gray-700 px-4 py-3">
  <div class="flex items-center gap-3">
    <div>
      <h3 class="text-lead">Review generated code</h3>
      <p class="text-caption text-gray-300">Edit as needed before saving.</p>
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
