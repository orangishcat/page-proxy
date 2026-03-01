<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import { browser } from "wxt/browser";
  import { CircleQuestionMark } from "lucide-svelte";

  import { detectBrowserSupport } from "@/lib/utils/browser-support";
  import { ensureCodeRunnerUserscript } from "@/lib/userscript-runner";
  import {
    readHelpBannerDismissedSetting,
    readUserscriptReloadBannerDismissedSetting,
    saveHelpBannerDismissedSetting,
    saveUserscriptReloadBannerDismissedSetting,
  } from "../tools/state-storage";
  import StackTraceView from "../tools/StackTraceView.svelte";
  import {
    errorMessage,
    errorStackTrace,
    setErrorMessage,
    setSuccessMessage,
    successMessage,
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
  const errorMessageValue = $derived($errorMessage);
  const errorStackTraceValue = $derived($errorStackTrace);
  const successMessageValue = $derived($successMessage);

  onMount(() => {
    void detectBrowserSupport().then(({ browser: supportedBrowser, supported }) => {
      showUnsupportedBrowserBanner = !supported;
      showFirefoxExperimentalBanner = supportedBrowser === "firefox";
      userscriptEnableWithFirefoxPermissions = supportedBrowser === "firefox";
    });

    void Promise.all([ensureCodeRunnerUserscript(), readUserscriptReloadBannerDismissedSetting()]).then(
      ([status, reloadBannerDismissed]) => {
        userscriptReloadBannerDismissed = reloadBannerDismissed;
        if (!status.ok && status.needsEnablement) {
          showUserscriptEnableBanner = true;
          return;
        }

        showUserscriptReloadBanner = status.ok && !reloadBannerDismissed;
      },
    );

    void readHelpBannerDismissedSetting().then((dismissed) => {
      showHelpBanner = !dismissed;
    });


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
    void saveUserscriptReloadBannerDismissedSetting(true);
  };

  const dismissHelpBanner = () => {
    showHelpBanner = false;
    void saveHelpBannerDismissedSetting(true);
  };

  const dismissStatusBanner = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const requestFirefoxUserscriptPermission = (event: MouseEvent) => {
    event.preventDefault();
    void browser.permissions
      .request({ permissions: ["userScripts"] })
      .then((granted) => {
        if (!granted) {
          setErrorMessage("Userscripts API permission was not granted.");
          return;
        }

        return ensureCodeRunnerUserscript().then((status) => {
          if (!status.ok) {
            setErrorMessage(status.message);
            return;
          }

          showUserscriptEnableBanner = false;
          showUserscriptReloadBanner = !userscriptReloadBannerDismissed;
          setErrorMessage(null);
          setSuccessMessage("Userscripts API enabled.");
        });
      })
      .catch(() => {
        setErrorMessage("Unable to request Userscripts API permission.");
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

  {#if errorMessageValue || successMessageValue}
    <Banner
      variant={successMessageValue ? "success" : "error"}
      dismissAriaLabel="Dismiss status message"
      onDismiss={dismissStatusBanner}
    >
      {#if successMessageValue}
        <span>{successMessageValue}</span>
      {:else}
        <div class="w-full">
          <span>{errorMessageValue}</span>
          {#if errorStackTraceValue}
            <StackTraceView stackTrace={errorStackTraceValue} />
          {/if}
        </div>
      {/if}
    </Banner>
  {/if}
</div>
