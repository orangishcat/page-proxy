<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    class: className = "",
    centered = true,
  }: { children: Snippet; class?: string; centered?: boolean } = $props();
</script>

<div
  class={`pp-no-select-tool fixed inset-0 z-2147483646 bg-black/50 ${centered ? "flex items-center justify-center p-4" : ""} ${className}`}
>
  {@render children()}
</div>
