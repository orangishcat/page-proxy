<script lang="ts">
  import { Navigation } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";
  import CodeEditorMock from "$lib/components/landing/CodeEditorMock.svelte";
  import LandingDemoToolbar from "$lib/components/landing/LandingDemoToolbar.svelte";

  const propertyRows = [
    { label: "ID", value: "semicircle-top-right" },
    { label: "Class", value: "semicircle tile highlighted" },
    { label: "Name", value: "Top-right semicircle" },
    { label: "Selector", value: "main > section > .semicircle-top-right" },
    { label: "BBox", value: "412, 131 @ 129, 64" },
  ];
</script>

<div class="flex h-138 w-full overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
  <section class="relative h-full flex-1 overflow-hidden bg-gray-900">
    <div class="absolute left-16.5 top-55.5 h-23 w-23 rounded-full border-2 border-gray-500 bg-gray-600 transition-colors duration-150 hover:border-accent-400"></div>
    <div class="absolute left-52.5 top-54.5 h-27 w-11 rounded border-2 border-gray-500 bg-gray-600 transition-colors duration-150 hover:border-accent-400"></div>
    <div class="absolute left-87.5 top-57.5 h-18 w-24 bg-gray-500 transition-colors duration-150 hover:bg-accent-400 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]">
      <div class="absolute inset-px bg-gray-600 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]"></div>
    </div>
    <div class="absolute left-49.5 top-29.25 h-20 w-20 rounded border-2 border-gray-500 bg-gray-600 transition-colors duration-150 hover:border-accent-400"></div>

    <div class="absolute bottom-12.5 left-53.5 h-35 w-48 border-2 border-gray-500 bg-gray-600 transition-colors duration-150 hover:border-accent-400"></div>
    <div class="absolute bottom-12.5 left-63.75 h-21 w-28 rounded-t-full border-2 border-gray-500 bg-gray-900 transition-colors duration-150 hover:border-accent-400"></div>

    <div class="semicircle-top-right target-focus absolute left-86.75 top-32.25 h-16 w-32 rounded-t-full border-2 border-gray-500 bg-gray-600 transition-colors duration-150 hover:border-accent-400"></div>

    <div class="cursor-selector absolute left-0 top-0 z-20 p-1">
      <Navigation class="h-6 w-6 -scale-x-100 fill-gray-950 text-gray-100" strokeWidth={2.1} />
    </div>
  </section>

  <aside class="flex h-full w-2/5 min-w-85 flex-col border-l border-gray-800 bg-gray-950">
    <section class="flex w-full shrink-0 flex-col bg-gray-900" aria-label="Tool panel">
      <LandingDemoToolbar title="Select" isPointerSelected={true} />

      <div class="relative flex h-62 min-h-0 flex-col px-4 py-4">
        <div class="empty-state flex min-h-0 flex-1 items-center justify-center text-xs text-gray-500">
          <div class="flex flex-col items-center gap-2">
            <span>Select an element to preview</span>
            <span>(Esc to cancel)</span>
          </div>
        </div>

        <div class="properties-state absolute inset-0 px-4 py-4 flex flex-col justify-between">
          <div class="grid grid-cols-[fit-content(112px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
            {#each propertyRows as property (property.label)}
              <span class="truncate text-right text-gray-500">{property.label}</span>
              <span class="truncate text-left font-mono text-gray-100">{property.value}</span>
            {/each}
          </div>

          <div class="save-selector-wrap mt-4 flex justify-center">
            <Button class="w-36! px-3! py-2! text-xs" variant="primary">Save selector</Button>
          </div>
        </div>
      </div>
    </section>

    <div class="h-2 w-full shrink-0 bg-gray-900"></div>

    <CodeEditorMock websiteText="example.com/*" />
  </aside>
</div>

<style>
  .cursor-selector {
    animation: cursor-slide-select 3s cubic-bezier(0.22, 0.89, 0.34, 1) infinite;
  }

  .target-focus {
    animation: target-selected 3s ease-in-out infinite;
  }

  .empty-state {
    animation: empty-state-fade 3s ease-in-out infinite;
  }

  .properties-state,
  .save-selector-wrap {
    animation: properties-fade 3s ease-in-out infinite;
  }

  @keyframes cursor-slide-select {
    0% {
      opacity: 0;
      transform: translate(624px, 336px) scale(1);
    }

    6% {
      opacity: 1;
    }

    34% {
      opacity: 1;
      transform: translate(382px, 160px) scale(1);
    }

    38% {
      opacity: 1;
      transform: translate(382px, 160px) scale(0.88);
    }

    42% {
      opacity: 1;
      transform: translate(382px, 160px) scale(1);
    }

    46% {
      opacity: 1;
      transform: translate(382px, 160px) scale(1);
    }

    50%,
    83.33% {
      opacity: 1;
      transform: translate(382px, 160px) scale(1);
    }

    90%,
    100% {
      opacity: 0;
      transform: translate(382px, 160px) scale(1);
    }
  }

  @keyframes target-selected {
    0%,
    35% {
      border-color: #787d78;
      box-shadow: 0 0 0 0 rgba(187, 147, 72, 0);
    }

    40%,
    100% {
      border-color: #bb9348;
      box-shadow: 0 0 0 4px rgba(187, 147, 72, 0.3);
    }
  }

  @keyframes empty-state-fade {
    0%,
    35% {
      opacity: 1;
      transform: translateY(0);
    }

    40%,
    100% {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  @keyframes properties-fade {
    0%,
    36% {
      opacity: 0;
      transform: translateY(6px);
    }

    42%,
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
