<script lang="ts">
  import { onMount } from "svelte";

  import Button from "@/lib/components/Button.svelte";
  import type { ScriptGrantValue } from "@/lib/grants";
  import { resolveGrantPermissionRequest } from "./grant-permissions/actions";
  import { clearGrantPermissionRequest, grantPermissionRequest, type GrantPermissionRequestState } from "./grant-permissions/state";
  import { allowedScriptGrantsState } from "./state-storage";
  import { setErrorMessage, setSuccessMessage } from "./tool-errors";

  let grantRequest = $state<GrantPermissionRequestState>(null);
  let isResolvingGrantRequest = $state(false);

  const formatGrantLabel = (grant: ScriptGrantValue) => grant;

  const resolveGrantRequest = (allow: boolean) => {
    if (!grantRequest || isResolvingGrantRequest) {
      return;
    }

    isResolvingGrantRequest = true;
    void resolveGrantPermissionRequest(
      {
        websiteGlob: grantRequest.websiteGlob,
        grants: grantRequest.grants,
      },
      allow,
    )
      .then((result) => {
        if (!result.ok) {
          setErrorMessage(result.error);
          return;
        }

        allowedScriptGrantsState.set(result.allowedGrants);
        clearGrantPermissionRequest();
        setSuccessMessage(allow ? "Grant permissions saved." : "Grant request denied.");
      })
      .catch(() => {
        setErrorMessage("Unable to update grant permissions.");
      })
      .finally(() => {
        isResolvingGrantRequest = false;
      });
  };

  onMount(() => {
    const unsubscribeGrantPermissionRequest = grantPermissionRequest.subscribe((value) => {
      grantRequest = value;
    });

    return () => {
      unsubscribeGrantPermissionRequest();
    };
  });
</script>

<div class="flex h-full w-full min-h-0 flex-1 flex-col px-4 py-4 gap-4 overflow-auto">
  {#if grantRequest}
    <div class="rounded-2xl border border-[#4f4a38] bg-[#24231f] p-4 space-y-3">
      <h2 class="text-title text-gray-100">Grant permissions</h2>
      <p class="text-body text-gray-300">The script is requesting the following permissions:</p>
      <ul class="list-disc pl-4 space-y-1.5 text-gray-200">
        {#each grantRequest.grants as grant (`${grantRequest.websiteGlob}-${grant}`)}
          <li>
            {#if grant === "run-on-page-load"}
              <a
                class="text-accent-500 underline decoration-accent-500/60 underline-offset-4 hover:text-accent-400"
                href="https://orangishcat.github.io/page-proxy/docs/permissions#grant-run-on-page-load"
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatGrantLabel(grant)}
              </a>
            {:else}
              <span class="text-gray-200">{formatGrantLabel(grant)}</span>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-gray-500 bg-gray-700 px-3 py-1.5 text-button text-gray-200 transition hover:opacity-80 active:opacity-60 disabled:opacity-50"
          onclick={() => resolveGrantRequest(false)}
          disabled={isResolvingGrantRequest}
        >
          Deny
        </button>
        <Button
          variant="primary"
          class="px-3! py-1.5!"
          onclick={() => resolveGrantRequest(true)}
          disabled={isResolvingGrantRequest}
        >
          Allow
        </Button>
      </div>
    </div>
  {/if}
  <div class="rounded-2xl border border-[#4f4a38] bg-[#24231f] p-4 space-y-2">
    <h2 class="text-title text-gray-100">
      Page Proxy Docs
      <span class="text-subtitle">v0.2.x</span>
    </h2>
    <p>Quick references for script metadata, permissions, and sidepanel tools.</p>
    <a
      class="text-body text-accent-500 underline decoration-accent-500/60 underline-offset-4 hover:text-accent-400"
      href="https://orangishcat.github.io/page-proxy/docs"
      target="_blank"
      rel="noopener noreferrer"
    >
      Open documentation
    </a>
  </div>
  <div class="rounded-2xl border border-[#4f4a38] bg-[#24231f] p-4 space-y-2">
    <h2 class="text-title text-gray-100">Known Issues</h2>
    <ul class="list-disc pl-4 space-y-1.5">
      <li>
        A site with a strict Content Security Policy (CSP) will block script execution (e.g. github.com, mozilla.org)
      </li>
      <li>Select tool doesn't work through iframes</li>
      <li>Loading the extension from a file often doesn't work</li>
    </ul>
    <a
      class="text-body text-accent-500 underline decoration-accent-500/60 underline-offset-4 hover:text-accent-400"
      href="https://github.com/orangishcat/page-proxy/issues"
      target="_blank"
      rel="noopener noreferrer"
    >
      Report issue
    </a>
  </div>
  <div class="rounded-2xl border border-[#4f4a38] bg-[#24231f] p-4 space-y-2">
    <h2 class="text-title text-gray-100">Planned features</h2>
    <ul class="list-disc pl-4 space-y-1.5">
      <li>Query by element CSS properties (e.g. match all red text)</li>
      <li>Website homepage needs a lot of doing</li>
      <li>
        Create tool:
        <ul class="list-disc pl-4 space-y-1.5">
          <li>Create a settings UI for your script (or any UI) easily</li>
          <li>Create components</li>
        </ul>
      </li>
      <li>Multi-file scripts</li>
      <li>
        <a
          href="https://github.com/orangishcat/page-proxy/blob/main/ROADMAP.md"
          target="_blank"
          rel="noopener noreferrer">More...</a
        >
      </li>
    </ul>
    <a
      class="text-body text-accent-500 underline decoration-accent-500/60 underline-offset-4 hover:text-accent-400"
      href="https://github.com/orangishcat/page-proxy/issues"
      target="_blank"
      rel="noopener noreferrer"
    >
      Feature requests are welcome
    </a>
  </div>
</div>
