<script lang="ts">
  import { onMount } from "svelte";

  import { loadAndRenderHelpMarkdown } from "@/lib/help/help-markdown";

  let isLoadingHelpContent = $state(true);
  let helpContentHtml = $state("");
  let helpContentError = $state<string | null>(null);

  const helpContentArticleClass =
    "text-body text-gray-200 space-y-3 [&_h1]:text-[1.45em] [&_h1]:font-semibold [&_h1]:leading-[1.2] [&_h1]:text-gray-100 [&_h1:not(:first-child)]:mt-[1.5em] [&_h1]:mb-[0.7em] [&_h1]:pb-[0.25em] [&_h1]:border-b [&_h1]:border-gray-700 [&_h2]:text-[1.25em] [&_h2]:font-semibold [&_h2]:leading-[1.25] [&_h2]:text-gray-100 [&_h2:not(:first-child)]:mt-[1.5em] [&_h2]:mb-[0.65em] [&_h2]:pb-[0.22em] [&_h2]:border-b [&_h2]:border-gray-700 [&_h3]:text-[1.1em] [&_h3]:font-semibold [&_h3]:leading-[1.3] [&_h3]:text-gray-200 [&_h3:not(:first-child)]:mt-[1.5em] [&_h3]:mb-[0.55em] [&_h3]:pb-[0.18em] [&_h3]:border-b [&_h3]:border-gray-700 [&_h4]:text-[1em] [&_h4]:font-semibold [&_h4]:leading-[1.35] [&_h4]:text-gray-200 [&_h4:not(:first-child)]:mt-[1.5em] [&_h4]:mb-[0.5em] [&_h4]:pb-[0.16em] [&_h4]:border-b [&_h4]:border-gray-700 [&_h5]:text-[0.94em] [&_h5]:font-semibold [&_h5]:leading-[1.4] [&_h5]:text-gray-300 [&_h5:not(:first-child)]:mt-[1.5em] [&_h5]:mb-[0.45em] [&_h5]:pb-[0.14em] [&_h5]:border-b [&_h5]:border-gray-700 [&_h6]:text-[0.88em] [&_h6]:font-semibold [&_h6]:leading-[1.45] [&_h6]:text-gray-400 [&_h6:not(:first-child)]:mt-[1.5em] [&_h6]:mb-[0.4em] [&_h6]:pb-[0.12em] [&_h6]:border-b [&_h6]:border-gray-700 [&_p]:leading-relaxed [&_a]:text-accent-500 [&_a]:underline [&_a]:decoration-accent-500/60 [&_a]:underline-offset-4 [&_a:hover]:text-accent-400 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1.5 [&_code]:font-mono [&_code]:rounded [&_code]:bg-gray-900 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-gray-900 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0";

  const loadHelpContent = async () => {
    isLoadingHelpContent = true;
    helpContentError = null;

    try {
      try {
        helpContentHtml = await loadAndRenderHelpMarkdown();
      } catch (error) {
        helpContentHtml = "";
        helpContentError = error instanceof Error ? error.message : "Unable to load help content.";
      }
    } finally {
      isLoadingHelpContent = false;
    }
  };

  onMount(() => {
    void loadHelpContent();
  });
</script>

<div class="flex h-full w-full min-h-0 flex-1 flex-col px-4 py-4 gap-4 overflow-auto">
  <div class="rounded-2xl p-4 space-y-3">
    {#if isLoadingHelpContent}
      <p class="text-body text-gray-300">Loading help content...</p>
    {:else if helpContentError}
      <p class="text-body text-red-300">{helpContentError}</p>
    {:else}
      <article class={helpContentArticleClass}>
        {@html helpContentHtml}
      </article>
    {/if}
  </div>
</div>
