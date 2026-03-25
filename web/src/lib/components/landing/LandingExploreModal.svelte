<script lang="ts">
  import { asset } from "$app/paths";
  import { Dialog } from "bits-ui";
  import { Download, X } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";
  import type { LandingExampleScript } from "./landing-example-script";
  import LandingCodePreview from "./LandingCodePreview.svelte";

  type Props = {
    example: LandingExampleScript | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  };

  let { example, open = false, onOpenChange = () => {} }: Props = $props();

  const editorHint = "go to a page that matches the glob, then copy and paste the script into the extension sidepanel!";
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-[#10110f]/72 backdrop-blur-md" />

    {#if example}
      <Dialog.Content
        class="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[2rem] border border-gray-200 bg-[#f8f6f0] shadow-[0_2rem_7rem_rgba(15,15,10,0.3)] outline-none dark:border-gray-800 dark:bg-[#171714]"
      >
        <div class="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span
                class="rounded-full border border-accent-200 bg-accent-100 px-3 py-1 font-semibold uppercase tracking-[0.18em] text-accent-800 dark:border-accent-900/70 dark:bg-accent-900/30 dark:text-accent-200"
              >
                {example.category}
              </span>
              <span
                class="rounded-full border border-gray-200 px-3 py-1 text-gray-600 dark:border-gray-700 dark:text-gray-300"
              >
                {example.downloadName}
              </span>
            </div>

            <div class="space-y-2">
              <Dialog.Title class="text-heading text-gray-950 dark:text-white">
                {example.title}
              </Dialog.Title>
              <Dialog.Description class="max-w-3xl text-subtitle leading-relaxed text-gray-600 dark:text-gray-300">
                {example.cardDescription}
              </Dialog.Description>
            </div>

            <p class="text-sm text-gray-500 dark:text-gray-400">
              Matches <span class="font-semibold text-gray-700 dark:text-gray-200">{example.website}</span>
            </p>
          </div>

          <Dialog.Close
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:bg-[#20201c] dark:text-gray-300 dark:hover:bg-[#2a2a25] dark:hover:text-white"
            aria-label="Close example modal"
          >
            <X class="h-5 w-5" />
          </Dialog.Close>
        </div>

        <div class="flex min-h-0 flex-1 flex-col px-6 py-5">
          <div
            class="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-inner dark:border-gray-800 dark:bg-[#11110f]"
          >
            <LandingCodePreview value={example.content} />
          </div>
        </div>

        <div
          class="flex flex-col gap-4 border-t border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800"
        >
          <p class="text-subtitle max-w-2xl text-gray-600 dark:text-gray-300">
            {editorHint}
          </p>

          <a href={asset(`/examples/${example.fileName}`)} download={example.downloadName}>
            <Button variant="primary" class="inline-flex items-center gap-2 px-5 py-2.5">
              <Download class="h-4 w-4" />
              Download script
            </Button>
          </a>
        </div>
      </Dialog.Content>
    {/if}
  </Dialog.Portal>
</Dialog.Root>
