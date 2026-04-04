<script lang="ts">
  import { Globe } from "lucide-svelte";
  import type { LandingExampleScript } from "./landing-example-script";
  import { landingExampleScripts } from "./landing-example-scripts";
  import LandingExploreModal from "./LandingExploreModal.svelte";

  let selectedExample = $state<LandingExampleScript | null>(null);
  let modalOpen = $state(false);

  const openExample = (example: LandingExampleScript) => {
    selectedExample = example;
    modalOpen = true;
  };

  const handleModalOpenChange = (nextOpen: boolean) => {
    modalOpen = nextOpen;
    if (!nextOpen) {
      selectedExample = null;
    }
  };
</script>

<section class="mx-auto flex w-full max-w-7xl flex-col gap-10 py-28" id="explore">
  <div class="mx-auto max-w-3xl space-y-6 text-center">
    <h2 class="text-heading">Explore</h2>
    <p class="text-subtitle leading-relaxed text-gray-600 dark:text-gray-300">
      A few handy utility scripts I made to get you started. Can you make something cooler?
    </p>
  </div>

  <div class="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
    {#each landingExampleScripts as example (example.id)}
      <div
        class="group flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-[#2D302C] text-left transition duration-200"
      >
        <div class="flex flex-1 flex-col justify-between gap-6 px-5 py-5">
          <div class="space-y-2">
            <h3 class="text-title text-gray-950 dark:text-white">{example.title}</h3>
            <p class="text-body leading-relaxed text-gray-600 dark:text-gray-300">{example.cardDescription}</p>
          </div>

          <div class="flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span class="inline-flex min-w-0 items-center gap-2">
              <Globe class="h-4 w-4 shrink-0" />
              <span class="truncate">{example.website}</span>
            </span>
            <button
              type="button"
              class="font-semibold text-accent-600 dark:text-accent-400 hover:opacity-40 hover:underline cursor-pointer"
              onclick={() => openExample(example)}>Open</button
            >
          </div>
        </div>
      </div>
    {/each}
  </div>

  <LandingExploreModal example={selectedExample} open={modalOpen} onOpenChange={handleModalOpenChange} />
</section>
