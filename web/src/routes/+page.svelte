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
  <div class="mx-auto flex w-full max-w-[70.875em] flex-col px-[5.9375em] pb-[14em] pt-[1.1875em]">
    <Navbar variant="landing" />

    <section class="mt-[10.1em]">
      <div class="mx-auto flex max-w-[62.375em] flex-col items-center gap-[1em] text-center">
        <h1 class="text-display leading-[1.15] text-[#20211f] dark:text-white">
          Customization at your <span class="text-accent-500">fingertips.</span>
        </h1>
        <p class="max-w-[55.4em] text-[1.125em] leading-[2.75em] text-[#5e635e] dark:text-[#a8a8a8]">
          A set of developer tools to manipulate <em class="italic text-[#5e635e] dark:text-[#b1b4ad]">any</em> webpage to your will.
        </p>

        <div class="mt-[0.75em] flex items-center gap-[1.2em]">
          <a href={resolve("/install")}> 
            <Button
              variant="primary"
              class="!rounded-[0.6em] !border-[#cb9330] !bg-[#deb700] !px-[1.25em] !py-[0.62em] text-[0.75em] text-white"
            >
              Install
            </Button>
          </a>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              class="!rounded-[0.6em] !border !border-[#7f7f7f] !px-[1.2em] !py-[0.62em] text-[0.75em] text-white dark:text-white"
            >
              View on GitHub
            </Button>
          </a>
        </div>
      </div>
    </section>

    <section class="mt-[10.1em] flex flex-col items-center">
      <h2 class="text-center text-[1.125em] leading-[1.7em] text-[#2b2c2a] dark:text-white">
        <span class="font-semibold">Quick, robust tooling.</span>
        <br />
        <span class="font-normal text-[#5e635e] dark:text-[#c1c6c1]">All your important tools in one place.</span>
      </h2>

      <div class="mt-[2.3em] w-full max-w-[59em]">
        <LandingDemoSelect />
      </div>
    </section>

    <section class="mt-[10.1em] flex flex-col items-center">
      <h2 class="text-center text-[1.125em] leading-[1.7em] text-[#2b2c2a] dark:text-white">
        <span class="font-semibold">In the toolbar, ready when you are.</span>
        <br />
        <span class="font-normal text-[#5e635e] dark:text-[#c1c6c1]">Perfect for lazy people like me.</span>
      </h2>

      <div class="mt-[2.7em] w-full max-w-[59em]">
        <LandingDemoNotification />
      </div>
    </section>

    <section class="mt-[10.2em] flex flex-col items-center">
      <img src={asset("/logo_filled.png")} alt="Page Proxy logo" class="h-[12.05em] w-[12.05em]" draggable="false" />
      <h3 class="mt-[0.9em] text-center text-[2.734em] font-bold leading-[1.1] text-[#20211f] dark:text-white">Want to try it out?</h3>

      <div class="mt-[2.5em] flex items-center gap-[1.2em]">
        <a href={resolve("/install")}> 
          <Button
            variant="primary"
            class="!rounded-[0.6em] !border-[#cb9330] !bg-[#deb700] !px-[1.25em] !py-[0.62em] text-[0.75em] text-white"
          >
            Install
          </Button>
        </a>
        <a href={githubUrl} target="_blank" rel="noopener noreferrer">
          <Button
            variant="outline"
            class="!rounded-[0.6em] !border !border-[#7f7f7f] !px-[1.2em] !py-[0.62em] text-[0.75em] text-white dark:text-white"
          >
            View on GitHub
          </Button>
        </a>
      </div>
    </section>
  </div>
</main>
