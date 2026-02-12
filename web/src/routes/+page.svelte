<script lang="ts">
  import Navbar from "$lib/components/Navbar.svelte";
</script>

<svelte:head>
  <title>Home</title>
</svelte:head>

<main class="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
  <div class="mx-auto flex justify-center place-items-center min-h-[90vh] w-full flex-col px-6 pb-12 pt-6">
    <Navbar variant="landing" />

    <section class="flex flex-1 items-center justify-center">
      <div class="flex flex-col gap-8 text-center">
        <h1 class="text-display font-semibold text-gray-900 dark:text-gray-100">
          Customization at your <span class="text-accent-500">fingertips</span>.
        </h1>
        <p class="text-2xl leading-relaxed text-gray-600 dark:text-gray-300">
          A robust developer toolchain to manipulate <b>any</b> webpage to your will.
          <br />
        </p>
      </div>
    </section>
  </div>
</main>
