<svelte:head>
  <title>Dashboard | Page Proxy</title>
</svelte:head>

<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';

  const cards = Array.from({ length: 6 });
</script>

<main class="min-h-screen bg-[#222121] text-gray-100">
  <div class="mx-auto flex w-full max-w-[70rem] flex-col gap-14 px-6 pb-20 pt-8">
    <Navbar variant="dashboard" />

    <section class="grid gap-6 md:grid-cols-3">
      {#each cards as _, index (index)}
        <article class="rounded-[2rem] bg-[#2d2d2b] p-5 shadow-[0_1rem_2.2rem_rgba(0,0,0,0.35)]">
          <div class="h-36 rounded-[1.5rem] bg-[#3a3a36] md:h-40"></div>
          <div class="mt-5 flex items-center gap-4">
            <div class="relative h-10 w-12">
              <div class="absolute left-0 top-1 h-8 w-8 rounded-full bg-gray-200"></div>
              <div class="absolute left-4 top-0 h-8 w-8 rounded-full bg-gray-200"></div>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <strong class="text-sm font-semibold text-gray-100">Amazon Redesign</strong>
              <span class="text-xs text-gray-300">Author 1, Author 2</span>
            </div>
          </div>
        </article>
      {/each}
    </section>
  </div>
</main>
