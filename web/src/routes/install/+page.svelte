<script lang="ts">
  import { asset } from "$app/paths";
  import { DropdownMenu } from "bits-ui";
  import { SiFirefoxbrowser, SiGooglechrome } from "@icons-pack/svelte-simple-icons";
  import Navbar from "$lib/components/Navbar.svelte";
  import { releaseVersion } from "$lib/utils/release-version";
  import { ChevronDown } from "lucide-svelte";
  import { onMount } from "svelte";

  const releaseLatestUrl = "https://github.com/orangishcat/page-proxy/releases/latest";
  let selectedBrowser = $state<"chrome" | "firefox">("chrome");
  let selectedInstallMethod = $state<"load-unpacked" | "install-from-file">("load-unpacked");
  let browserDropdownOpen = $state(false);
  let installMethodDropdownOpen = $state(false);
  const version = releaseVersion;

  const browserLabel = {
    chrome: "Chrome",
    firefox: "Firefox",
  } as const;
  const installMethodLabel = {
    "load-unpacked": "Load unpacked",
    "install-from-file": "Install from file",
  } as const;

  const triggerClasses =
    "text-body flex w-full items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-left text-gray-700 shadow-lg hover:bg-gray-200 active:bg-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:active:bg-gray-600";
  const contentClasses =
    "grid min-w-64 gap-1.5 rounded-lg border border-gray-200 bg-gray-100 p-1 text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
  const itemClasses =
    "text-body cursor-pointer rounded-lg px-3 py-2 text-left hover:bg-gray-200 active:bg-gray-300 dark:hover:bg-gray-700 dark:active:bg-gray-600";
  const olClasses = "mt-3 list-decimal space-y-1 pl-7 text-gray-700 dark:text-gray-300 space-y-3 [&>li]:pl-1";
  const browserIconClasses = "h-4 w-4 shrink-0";

  onMount(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("firefox")) {
      selectedBrowser = "firefox";
    } else {
      selectedBrowser = "chrome";
    }
  });
</script>

<svelte:head>
  <title>Install</title>
</svelte:head>

<main class="flex min-h-screen w-full items-center bg-page-light text-gray-900 dark:bg-page dark:text-gray-100">
  <div class="mx-auto flex h-screen w-full max-w-7xl flex-col gap-10 px-6 py-6">
    <Navbar variant="landing" />

    <section class="mx-auto grid w-full items-center gap-8 md:grid-cols-5 mt-12">
      <div class="flex justify-center md:col-span-2">
        <img src={asset("/logo_filled.avif")} alt="Page Proxy" class="h-auto w-72" />
      </div>

      <div class="flex w-full flex-col place-items-start justify-center space-y-4 md:col-span-3 h-[60vh]">
        <h1 class="text-display mt-8 mb-8">v{version}</h1>
        <div
          class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 text-base dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="grid gap-3 md:grid-cols-2">
            <DropdownMenu.Root bind:open={browserDropdownOpen}>
              <DropdownMenu.Trigger class={triggerClasses}>
                <span class="flex items-center gap-2">
                  {#if selectedBrowser === "chrome"}
                    <SiGooglechrome class={browserIconClasses} title="Chrome" />
                  {:else}
                    <SiFirefoxbrowser class={browserIconClasses} title="Firefox" />
                  {/if}
                  <span>{browserLabel[selectedBrowser]}</span>
                </span>
                <ChevronDown
                  class={`h-4 w-4 transition-transform duration-150 ${browserDropdownOpen ? "rotate-180" : ""}`}
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class={contentClasses} preventScroll={false}>
                  <DropdownMenu.Item
                    class={itemClasses}
                    onclick={() => {
                      selectedBrowser = "chrome";
                      browserDropdownOpen = false;
                    }}
                  >
                    <span class="flex items-center gap-2">
                      <SiGooglechrome class={browserIconClasses} title="Chrome" />
                      <span>Chrome</span>
                    </span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    class={itemClasses}
                    onclick={() => {
                      selectedBrowser = "firefox";
                      browserDropdownOpen = false;
                    }}
                  >
                    <span class="flex items-center gap-2">
                      <SiFirefoxbrowser class={browserIconClasses} title="Firefox" />
                      <span>Firefox</span>
                    </span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <DropdownMenu.Root bind:open={installMethodDropdownOpen}>
              <DropdownMenu.Trigger class={triggerClasses}>
                <span>{installMethodLabel[selectedInstallMethod]}</span>
                <ChevronDown
                  class={`h-4 w-4 transition-transform duration-150 ${installMethodDropdownOpen ? "rotate-180" : ""}`}
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class={contentClasses} preventScroll={false}>
                  <DropdownMenu.Item
                    class={itemClasses}
                    onclick={() => {
                      selectedInstallMethod = "load-unpacked";
                      installMethodDropdownOpen = false;
                    }}
                  >
                    Load unpacked
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    class={itemClasses}
                    onclick={() => {
                      selectedInstallMethod = "install-from-file";
                      installMethodDropdownOpen = false;
                    }}
                  >
                    Install from file
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {#if selectedInstallMethod === "install-from-file"}
            <div
              class="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            >
              Recommended: use <span class="font-semibold">Load unpacked</span>. Installing from a file may cause
              unexpected issues.
            </div>
          {/if}

          {#if selectedBrowser === "chrome" && selectedInstallMethod === "load-unpacked"}
            <ol class={olClasses}>
              <li>
                Download <code>pp-chrome-source-v{version}.zip</code> from
                <a href={releaseLatestUrl}>GitHub releases</a>.
              </li>
              <li>Unzip <code>pp-chrome-source-v{version}.zip</code>.</li>
              <li>You should end up with extracted files that include <code>manifest.json</code>.</li>
              <li>Open <code>chrome://extensions</code>.</li>
              <li>Enable <span class="font-semibold">Developer mode</span>.</li>
              <li>Click <span class="font-semibold">Load unpacked</span>.</li>
              <li>Choose the extracted extension folder.</li>
            </ol>
          {:else if selectedBrowser === "chrome" && selectedInstallMethod === "install-from-file"}
            <ol class={olClasses}>
              <li>
                Download <code>pp-chrome-crx-v{version}.crx</code> from
                <a href={releaseLatestUrl}>GitHub releases</a>.
              </li>
              <li>You should have the file <code>pp-chrome-crx-v{version}.crx</code>.</li>
              <li>Open <code>chrome://extensions</code>.</li>
              <li>Enable <span class="font-semibold">Developer mode</span>.</li>
              <li>Drag and drop <code>pp-chrome-crx-v{version}.crx</code>.</li>
            </ol>
          {:else if selectedBrowser === "firefox" && selectedInstallMethod === "load-unpacked"}
            <ol class={olClasses}>
              <li>
                Download <code>pp-ff-source-v{version}.zip</code> from
                <a href={releaseLatestUrl}>GitHub releases</a>.
              </li>
              <li>Unzip <code>pp-ff-source-v{version}.zip</code>.</li>
              <li>You should end up with extracted files that include <code>manifest.json</code>.</li>
              <li>Open <code>about:debugging#/runtime/this-firefox</code>.</li>
              <li>Click <span class="font-semibold">Load Temporary Add-on…</span>.</li>
              <li>Choose <code>manifest.json</code> from the extracted folder.</li>
            </ol>
          {:else}
            <ol class={olClasses}>
              <li>
                Download <code>pp-ff-xpi-v{version}.xpi</code> from
                <a href={releaseLatestUrl}>GitHub releases</a>.
              </li>
              <li>You should have the file <code>pp-ff-xpi-v{version}.xpi</code>.</li>
              <li>Open <code>about:addons</code>.</li>
              <li>Select <span class="font-semibold">Install Add-on From File…</span>.</li>
              <li>Choose <code>pp-ff-xpi-v{version}.xpi</code>.</li>
            </ol>
          {/if}
        </div>
      </div>
    </section>
  </div>
</main>
