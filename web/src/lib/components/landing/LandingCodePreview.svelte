<script lang="ts">
  import { onMount } from "svelte";
  import type { LandingMonacoPreviewHandle } from "./landing-monaco";

  type Props = {
    value: string;
  };

  let { value }: Props = $props();

  let containerEl = $state<HTMLElement | null>(null);
  let previewReady = $state(false);
  let previewHandle: LandingMonacoPreviewHandle | null = null;

  onMount(() => {
    let isActive = true;

    if (!containerEl) {
      return;
    }

    void import("./landing-monaco").then(({ createLandingMonacoPreview }) => {
      if (!isActive || !containerEl) {
        return;
      }

      previewHandle = createLandingMonacoPreview(containerEl, value);
      previewReady = true;
    });

    return () => {
      isActive = false;
      previewHandle?.destroy();
      previewHandle = null;
      previewReady = false;
    };
  });
</script>

<div class="relative h-[20rem] w-full overflow-hidden md:h-[26rem]">
  <div bind:this={containerEl} class="h-full w-full"></div>

  {#if !previewReady}
    <div
      class="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#f5f4f1] text-sm font-medium text-gray-500 dark:bg-[#1d1d19] dark:text-gray-400"
    >
      Loading preview...
    </div>
  {/if}
</div>
