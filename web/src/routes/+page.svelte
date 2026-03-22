<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import Navbar from "$lib/components/Navbar.svelte";
  import Button from "$lib/components/Button.svelte";
  import LandingDemoSelect from "$lib/components/landing/LandingDemoSelect.svelte";
  import LandingFeatureList from "$lib/components/landing/LandingFeatureList.svelte";

  const githubUrl = "https://github.com/orangishcat/page-proxy";
</script>

<svelte:head>
  <title>Page Proxy</title>
</svelte:head>

<main class="min-h-screen bg-page-light text-[#20211f] dark:bg-page dark:text-white">
  <div class="mx-auto flex w-full max-w-7xl flex-col px-6 pt-5 sm:px-10 lg:px-16">
    <Navbar variant="landing" />
  </div>

  <div class="flex w-full flex-col py-16">
    <section>
      <div class="mx-auto w-full max-w-7xl py-32">
        <div class="mx-auto flex flex-col items-center gap-4 text-center space-y-2">
          <h1 class="text-display text-[#20211f] dark:text-white">
            Customization at your <span class="text-accent-500">fingertips.</span>
          </h1>
          <p class="text-2xl text-[#5e635e] dark:text-[#a8a8a8]">
            An all-in-one userscript manager and creator to manipulate the web to your will.
          </p>

          <div class="mt-2 flex items-center gap-5">
            <a href={resolve("/install")}>
              <Button variant="primary" class="w-32">Install</Button>
            </a>
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                class="rounded-lg border border-gray-700 px-5 py-2.5 text-black dark:text-white"
              >
                Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="py-16 flex flex-col items-center" id="tools">
      <div class="mx-auto w-full text-center max-w-7xl py-16">
        <h2 class="text-4xl font-bold text-gray-900 dark:text-white">Simple, robust workflow.</h2>
        <p class="text-subtitle text-gray-600 mt-4 dark:text-gray-300">
          Perform an action, record it, then convert it to code to keep your changes.
        </p>

        <div class="mt-9 w-full">
          <LandingDemoSelect />
        </div>
      </div>
    </section>

    <div class="py-16">
      <LandingFeatureList />
    </div>

    <div id="explore"></div>

    <section class="mx-auto flex w-full max-w-7xl flex-col items-center space-y-6 py-16">
      <img src={asset("/logo_filled.avif")} alt="Page Proxy logo" class="h-50 w-50" draggable="false" />
      <h3 class="text-heading mt-4 text-center text-[#20211f] dark:text-white">Want to try it out?</h3>

      <div class="flex items-center gap-5">
        <a href={resolve("/install")}>
          <Button variant="primary">Install</Button>
        </a>
        <a href={githubUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" class="rounded-lg border border-gray-700 px-5 py-2.5 text-black dark:text-white">
            Star on GitHub
          </Button>
        </a>
      </div>
    </section>
  </div>
</main>
