<script lang="ts">
  import { asset } from "$app/paths";
  import { Tabs } from "bits-ui";
  import Navbar from "$lib/components/Navbar.svelte";
  import { onMount } from "svelte";

  const releaseLatestUrl = "https://github.com/orangishcat/page-proxy/releases/latest";
  let selectedBrowser = $state<"chrome" | "firefox">("chrome");
  const tabClasses =
    "rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition data-[state=active]:bg-accent-500/70 " +
    "data-[state=active]:text-gray-950 data-[state=inactive]:dark:text-gray-400 data-[state=active]:dark:text-gray-100 cursor-pointer";

  onMount(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("firefox")) {
      selectedBrowser = "firefox";
      return;
    }
    selectedBrowser = "chrome";
  });
</script>

<svelte:head>
  <title>Install</title>
</svelte:head>

<main class="flex min-h-screen w-full items-center bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
  <div class="mx-auto flex h-screen w-full max-w-7xl flex-col gap-10 px-6 py-6">
    <Navbar variant="landing" />

    <section class="mx-auto grid w-full items-center gap-8 md:grid-cols-5">
      <div class="flex justify-center md:col-span-2">
        <img src={asset("/logo_filled.png")} alt="Page Proxy" class="h-auto w-72" />
      </div>

      <div class="flex w-full flex-col place-items-start justify-center space-y-4 md:col-span-3">
        <h1 class="text-display mt-8 mb-8">Install</h1>
        <ol class="text-2xl space-y-3">
          <li>
            <span class="mr-3">1.</span> Download the latest release from
            <a href={releaseLatestUrl} class="text-accent-600">GitHub</a>.
          </li>
          <li><span class="mr-3">2.</span> Extract the <code>zip</code> file.</li>
          <li>
            <span class="mr-3">3.</span> Load the extension from a file:
            <Tabs.Root
              bind:value={selectedBrowser}
              class="mt-12 rounded-2xl border border-gray-200 bg-white p-4 text-base dark:border-gray-800 dark:bg-gray-900"
            >
              <Tabs.List class="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-950">
                <Tabs.Trigger value="chrome" class={tabClasses}>Chrome</Tabs.Trigger>
                <Tabs.Trigger value="firefox" class={tabClasses}>Firefox</Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="chrome">
                <ol class="mt-3 list-decimal space-y-1 pl-5 text-gray-700 dark:text-gray-300">
                  <li>Open <code>chrome://extensions</code>.</li>
                  <li>Enable <span class="font-semibold">Developer mode</span>.</li>
                  <li>Drag and drop the <code>.crx</code> file.</li>
                </ol>
              </Tabs.Content>
              <Tabs.Content value="firefox">
                <ol class="mt-3 list-decimal space-y-1 pl-5 text-gray-700 dark:text-gray-300">
                  <li>Open <code>about:addons</code>.</li>
                  <li>Select <span class="font-semibold">Install Add-on From File…</span>.</li>
                  <li>Choose the <code>.xpi</code> file.</li>
                </ol>
              </Tabs.Content>
            </Tabs.Root>
          </li>
        </ol>
      </div>
    </section>
  </div>
</main>
