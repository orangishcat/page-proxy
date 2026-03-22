<script lang="ts">
  import { asset } from "$app/paths";

  const editorPreviewSrc = asset("/assets/code_editor_empty.avif");
</script>

<div class="mx-auto h-96 w-full max-w-lg overflow-hidden" aria-hidden="true">
  <img src={editorPreviewSrc} alt="" class="block w-full select-none object-cover object-top" draggable="false" />
</div>
