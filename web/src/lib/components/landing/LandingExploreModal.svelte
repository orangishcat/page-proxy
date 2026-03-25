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
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />

    {#if example}
      <Dialog.Content
        class="fixed left-1/2 top-1/2 z-50 flex max-h-[min(40em,calc(100vh-2rem))] w-[min(64em,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[#4f4a38] bg-[#24231f] text-gray-100 shadow-2xl outline-none"
      >
        <div class="flex items-start justify-between gap-4 border-b border-gray-800 bg-gray-900 px-5 py-3">
          <div class="space-y-2">
            <Dialog.Title class="text-xl font-semibold text-gray-100">
              {example.title}
              <span class="text-lg font-light">
                <span class="text-gray-500 dark:text-gray-400">@</span>
                <span class="font-semibold text-accent-400">{example.website}</span>
              </span>
            </Dialog.Title>
            <Dialog.Description class="max-w-3xl text-gray-300">
              {example.cardDescription}
            </Dialog.Description>
          </div>

          <Dialog.Close
            class="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/20 bg-transparent text-gray-500 transition hover:bg-white/10 hover:text-gray-300 cursor-pointer"
            aria-label="Close example modal"
          >
            <X class="h-4 w-4" />
          </Dialog.Close>
        </div>

        <LandingCodePreview value={example.content} />

        <div
          class="flex flex-col gap-4 border-t border-gray-800 bg-[#24231f] px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-subtitle text-gray-300">
            Go to a page that matches the glob, then copy and paste the script into the extension sidepanel!
          </p>

          <a href={asset(`/examples/${example.fileName}`)} download={example.downloadName}>
            <Button variant="secondary" class="inline-flex items-center gap-2 px-5 py-2.5">
              <Download class="h-4 w-4" />
              Try it out
            </Button>
          </a>
        </div>
      </Dialog.Content>
    {/if}
  </Dialog.Portal>
</Dialog.Root>
