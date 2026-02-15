<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import Navbar from "$lib/components/Navbar.svelte";
  import Button from "$lib/components/Button.svelte";
  import LandingDemoSelect from "$lib/components/landing/LandingDemoSelect.svelte";
  import LandingDemoNotification from "$lib/components/landing/LandingDemoNotification.svelte";

  const githubUrl = "https://github.com/orangishcat/page-proxy";
</script>

<svelte:head>
  <title>Page Proxy</title>
</svelte:head>

<main class="min-h-screen bg-[#f2f3f2] text-[#20211f] dark:bg-[#282824] dark:text-white">
  <div class="mx-auto flex w-full max-w-7xl flex-col px-6 pt-5 sm:px-10 lg:px-16">
    <Navbar variant="landing" />
  </div>

  <div class="mx-auto flex w-full max-w-6xl flex-col space-y-80 px-6 pb-56 pt-40 sm:px-10 lg:px-16">
    <section>
      <div class="mx-auto flex flex-col items-center gap-4 text-center">
        <h1 class="text-display text-[#20211f] dark:text-white">
          Customization at your <span class="text-accent-500">fingertips.</span>
        </h1>
        <p class="text-lead text-[#5e635e] dark:text-[#a8a8a8]">
          A set of developer tools to manipulate <em class="italic text-[#5e635e] dark:text-[#b1b4ad]">any</em> webpage to your will.
        </p>

        <div class="mt-3 flex items-center gap-5">
          <a href={resolve("/install")}>
            <Button
              variant="primary"
            >
              Install
            </Button>
          </a>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
            >
              View on GitHub
            </Button>
          </a>
        </div>
      </div>
    </section>

    <section class="flex flex-col items-center">
      <h2 class="text-center text-gray-900 dark:text-white">
        <span class="text-title">Quick, robust tooling.</span>
        <br />
        <span class="text-subtitle text-[#5e635e] dark:text-[#c1c6c1]">All your important tools in one place.</span>
      </h2>

      <div class="mt-9 w-full">
        <LandingDemoSelect />
      </div>
    </section>

    <section class="flex flex-col items-center">
      <h2 class="text-center text-gray-900 dark:text-white">
        <span class="text-title">In the toolbar, ready when you are.</span>
        <br />
        <span class="text-subtitle text-[#5e635e] dark:text-[#c1c6c1]">Perfect for lazy people like me.</span>
      </h2>

      <div class="mt-11 w-full">
        <LandingDemoNotification />
      </div>
    </section>

    <section class="flex flex-col items-center">
      <img src={asset("/logo_filled.png")} alt="Page Proxy logo" class="h-50 w-05" draggable="false" />
      <h3 class="text-heading mt-4 text-center text-[#20211f] dark:text-white">Want to try it out?</h3>

      <div class="mt-10 flex items-center gap-5">
        <a href={resolve("/install")}>
          <Button
            variant="primary"
          >
            Install
          </Button>
        </a>
        <a href={githubUrl} target="_blank" rel="noopener noreferrer">
          <Button
            variant="outline"
            class="rounded-lg border border-gray-700 px-5 py-2.5 text-white dark:text-white"
          >
            View on GitHub
          </Button>
        </a>
      </div>
    </section>
  </div>
</main>
