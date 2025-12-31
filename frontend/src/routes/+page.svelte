<svelte:head>
  <title>Page Proxy</title>
</svelte:head>

<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
</script>

<main class="min-h-screen bg-[#222121] text-gray-100">
  <div class="mx-auto flex justify-center place-items-center min-h-[90vh] w-full flex-col px-6 pb-12 pt-8">
    <Navbar variant="landing" />

    <section class="flex flex-1 items-center justify-center">
      <div class="flex flex-col gap-8 text-center">
        <h1 class="text-display font-semibold tracking-tight text-gray-100">
          Customization at your <span class="text-accent-500">fingertips</span>.
        </h1>
        <p class="text-2xl text-gray-300 leading-relaxed">
          A robust API and toolchain to improve the user experience of any website.
          <br />
          No code needed, just your creativity.
        </p>
      </div>
    </section>
  </div>
</main>
