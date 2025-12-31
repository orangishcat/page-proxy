<svelte:head>
  <title>Project | Page Proxy</title>
</svelte:head>

<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
</script>

<main class="min-h-screen bg-[#222121] text-gray-100">
  <div class="mx-auto flex w-full max-w-[78rem] flex-col gap-10 px-6 pb-20 pt-8">
    <div class="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <Navbar variant="app" />
      <button
        class="h-11 rounded-full bg-[#f3b54b] px-7 text-sm font-semibold text-[#1c1c1c] shadow-[0_0.6rem_1.4rem_rgba(0,0,0,0.25)] transition hover:opacity-90"
        type="button"
      >
        Export
      </button>
    </div>

    <section class="grid gap-6 lg:grid-cols-[2.1fr_1fr]">
      <div class="min-h-[32rem] rounded-[2.5rem] bg-[#3a3a36] shadow-[0_1.2rem_2.4rem_rgba(0,0,0,0.35)]"></div>

      <div class="flex flex-col gap-6">
        <div class="min-h-[15rem] rounded-[2.25rem] bg-[#3a3a36] shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.35)]"></div>
        <div class="min-h-[15rem] rounded-[2.25rem] bg-[#3a3a36] shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.35)]"></div>
      </div>
    </section>
  </div>
</main>
