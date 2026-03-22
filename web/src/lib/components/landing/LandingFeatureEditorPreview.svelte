<script lang="ts">
  import { asset } from "$app/paths";

  const editorPreviewSrc = asset("/assets/code_editor_empty.avif");
</script>

<div
  class="mx-auto absolute w-full max-w-lg overflow-hidden shadow-2xl border border-gray-300 dark:border-gray-800 rounded-sm"
  aria-hidden="true"
>
  <img src={editorPreviewSrc} alt="" class="block w-full select-none object-cover object-top" draggable="false" />
</div>
