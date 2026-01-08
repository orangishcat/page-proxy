<svelte:head>
  <title>Download</title>
</svelte:head>

<script lang="ts">
  import Navbar from '$lib/components/Navbar.svelte';
  import Button from '$lib/components/Button.svelte';
</script>

<main class="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
    <Navbar variant="landing" />

    <section class="grid gap-8 rounded-3xl bg-white p-10 shadow-xl dark:bg-gray-900">
      <div class="space-y-4">
        <p class="text-eyebrow text-gray-500 dark:text-gray-400">Download the Extension</p>
        <h1 class="text-display">Install Page Proxy in seconds.</h1>
        <p class="text-lead text-gray-600 dark:text-gray-300">
          Choose your browser and start styling any webpage directly from the extension dashboard.
        </p>
      </div>

      <div class="flex flex-wrap gap-4">
        <Button type="button">Download for Chrome</Button>
        <Button variant="outline" type="button">Download for Firefox</Button>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950">
          <p class="text-title">All pages</p>
          <p class="text-body mt-2 text-gray-600 dark:text-gray-400">
            Runs on every site you enable, with content scripts for instant tweaks.
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950">
          <p class="text-title">Live dashboard</p>
          <p class="text-body mt-2 text-gray-600 dark:text-gray-400">
            Manage sessions, presets, and experiments from one place.
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950">
          <p class="text-title">Fast setup</p>
          <p class="text-body mt-2 text-gray-600 dark:text-gray-400">
            Install, toggle, and start designing without extra tooling.
          </p>
        </div>
      </div>
    </section>
  </div>
</main>
