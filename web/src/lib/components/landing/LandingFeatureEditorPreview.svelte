<script lang="ts">
  import { asset } from "$app/paths";

  const editorPreviewSrc = asset("/assets/code_editor_saved.avif");
</script>

<div
  class="mx-auto absolute -translate-y-1/6 h-screen w-full max-w-lg overflow-hidden rounded-sm border border-gray-200 dark:border-gray-800 shadow-2xl"
  aria-hidden="true"
>
  <img src={editorPreviewSrc} alt="" class="block w-full select-none object-cover object-top" draggable="false" />
</div>
