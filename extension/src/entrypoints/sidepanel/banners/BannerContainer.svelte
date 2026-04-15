<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import { browser } from "wxt/browser";
  import { CircleQuestionMark } from "lucide-svelte";

  import { appState } from "@/lib/app-state/state.svelte.ts";
  import { appStateActions } from "@/lib/app-state/actions.ts";
  import { detectBrowserSupport } from "@/lib/utils/browser-support";
  import { ensureCodeRunnerUserscript } from "@/lib/userscript-runner";
  import {
    setToolMessage,
  } from "../tools/tool-errors";
  import Banner from "./Banner.svelte";

  const chromeUserscriptEnableInstructionsUrl =
    "https://developer.chrome.com/docs/extensions/reference/api/userScripts#" +
    "chrome_versions_138_and_newer_allow_user_scripts_toggle";

  let { children }: { children?: Snippet } = $props();

  let showUnsupportedBrowserBanner = $state(false);
  let showFirefoxExperimentalBanner = $state(false);
  let showUserscriptEnableBanner = $state(false);
  let showUserscriptReloadBanner = $state(false);
  let userscriptEnableWithFirefoxPermissions = $state(false);
  let userscriptReloadBannerDismissed = $state(false);
  let showHelpBanner = $state(true);

  onMount(() => {
    void detectBrowserSupport().then(({ browser: supportedBrowser, supported }) => {
      showUnsupportedBrowserBanner = !supported;
      showFirefoxExperimentalBanner = supportedBrowser === "firefox";
      userscriptEnableWithFirefoxPermissions = supportedBrowser === "firefox";
    });

    void ensureCodeRunnerUserscript().then((status) => {
      userscriptReloadBannerDismissed = appState.sidepanel.userscriptReloadBannerDismissed;
      if (!status.ok && status.needsEnablement) {
        showUserscriptEnableBanner = true;
        return;
      }

      showUserscriptReloadBanner = status.ok && !userscriptReloadBannerDismissed;
    });

    showHelpBanner = !appState.sidepanel.helpBannerDismissed;
  });

  const dismissUnsupportedBrowserBanner = () => {
    showUnsupportedBrowserBanner = false;
  };

  const dismissFirefoxExperimentalBanner = () => {
    showFirefoxExperimentalBanner = false;
  };

  const dismissUserscriptEnableBanner = () => {
    showUserscriptEnableBanner = false;
  };

  const dismissUserscriptReloadBanner = () => {
    showUserscriptReloadBanner = false;
    userscriptReloadBannerDismissed = true;
    appStateActions.dismissBanner("userscriptReloadBannerDismissed");
  };

  const dismissHelpBanner = () => {
    showHelpBanner = false;
    appStateActions.dismissBanner("helpBannerDismissed");
  };

  const requestFirefoxUserscriptPermission = (event: MouseEvent) => {
    event.preventDefault();
    void browser.permissions
      .request({ permissions: ["userScripts"] })
      .then((granted) => {
        if (!granted) {
          setToolMessage("Userscripts API permission was not granted.", "error");
          return;
        }

        return ensureCodeRunnerUserscript().then((status) => {
          if (!status.ok) {
            setToolMessage(status.message, "error");
            return;
          }

          showUserscriptEnableBanner = false;
          showUserscriptReloadBanner = !userscriptReloadBannerDismissed;
          setToolMessage("Userscripts API enabled.", "success");
        });
      })
      .catch(() => {
        setToolMessage("Unable to request Userscripts API permission.", "error");
      });
  };
</script>

<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
  {#if showUnsupportedBrowserBanner}
    <Banner
      variant="danger"
      dismissAriaLabel="Dismiss unsupported browser notice"
      onDismiss={dismissUnsupportedBrowserBanner}
    >
      <span>Your browser is not supported. Please use Chrome, Brave, or Firefox to avoid unexpected issues.</span>
    </Banner>
  {/if}

  {#if showFirefoxExperimentalBanner}
    <Banner
      variant="warning"
      dismissAriaLabel="Dismiss Firefox experimental notice"
      onDismiss={dismissFirefoxExperimentalBanner}
    >
      <span>Firefox support is experimental.</span>
    </Banner>
  {/if}

  {#if showUserscriptEnableBanner}
    <Banner
      variant="caution"
      dismissAriaLabel="Dismiss Userscripts API notice"
      onDismiss={dismissUserscriptEnableBanner}
    >
      <span>Page Proxy needs the Userscripts API to run untrusted scripts.</span>
      {#if userscriptEnableWithFirefoxPermissions}
        <a
          href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request"
          target="_blank"
          rel="noreferrer"
          class="font-semibold text-[#ffd8b0] underline underline-offset-2 hover:opacity-80"
          onclick={requestFirefoxUserscriptPermission}
        >
          Enable it here.
        </a>
      {:else}
        <a
          href={chromeUserscriptEnableInstructionsUrl}
          target="_blank"
          rel="noreferrer"
          class="font-semibold text-[#ffd8b0] underline underline-offset-2 hover:opacity-80"
        >
          Instructions to enable
        </a>
      {/if}
    </Banner>
  {/if}

  {#if !showUserscriptEnableBanner && showUserscriptReloadBanner}
    <Banner
      variant="info"
      dismissAriaLabel="Dismiss Userscript reload notice"
      onDismiss={dismissUserscriptReloadBanner}
    >
      <span>Note: you may need to reload all your tabs for the Userscript API to take effect.</span>
    </Banner>
  {/if}

  {#if !showUnsupportedBrowserBanner && showHelpBanner}
    <Banner
      variant="info"
      dismissAriaLabel="Dismiss help notice"
      onDismiss={dismissHelpBanner}
    >
      <span>Something not working? Check the Help tool</span>
      <CircleQuestionMark class="h-4 w-4" aria-hidden="true" />
      <span>for troubleshooting or</span>
      <a
        href="https://github.com/orangishcat/page-proxy"
        target="_blank"
        rel="noreferrer"
        class="font-semibold text-[#d4e9ff] underline underline-offset-2 hover:opacity-80"
      >
        report a bug
      </a>
      <span>.</span>
    </Banner>
  {/if}

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    {@render children?.()}
  </div>
</div>
