<script lang="ts">
  import DOMPurify from "dompurify";
  import { marked } from "marked";
  import { onMount } from "svelte";

  import Button from "@/lib/components/Button.svelte";
  import type { ScriptGrantValue } from "@/lib/grants";
  import { loadHelpContentMarkdown } from "@/lib/help/help-content";
  import { resolveGrantPermissionRequest } from "./grant-permissions/actions";
  import {
    clearGrantPermissionRequest,
    grantPermissionRequest,
    type GrantPermissionRequestState,
  } from "./grant-permissions/state";
  import { allowedScriptGrantsState } from "./state-storage";
  import { setErrorMessage, setSuccessMessage } from "./tool-errors";

  const helpDocUrl = "https://orangishcat.github.io/page-proxy/docs";

  let grantRequest = $state<GrantPermissionRequestState>(null);
  let isResolvingGrantRequest = $state(false);
  let isLoadingHelpContent = $state(true);
  let helpContentHtml = $state("");
  let helpContentError = $state<string | null>(null);

  const formatGrantLabel = (grant: ScriptGrantValue) => grant;
  const renderHelpContentMarkdown = (content: string) => {
    const renderedMarkdown = marked.parse(content, { async: false, breaks: true });
    if (typeof renderedMarkdown !== "string") {
      throw new Error("Unable to render help content.");
    }

    return DOMPurify.sanitize(renderedMarkdown);
  };

  const loadHelpContent = () => {
    isLoadingHelpContent = true;
    helpContentError = null;

    return loadHelpContentMarkdown()
      .then((content) => {
        helpContentHtml = renderHelpContentMarkdown(content);
      })
      .catch((error: unknown) => {
        helpContentHtml = "";
        helpContentError = error instanceof Error ? error.message : "Unable to load help content.";
      })
      .finally(() => {
        isLoadingHelpContent = false;
      });
  };

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
        setSuccessMessage(
          allow ? "Grant permissions saved (reload the page for permissions to take effect)." : "Grant request denied.",
        );
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

    void loadHelpContent();

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
  <div class="rounded-2xl border border-[#4f4a38] bg-[#24231f] p-4 space-y-3">
    {#if isLoadingHelpContent}
      <p class="text-body text-gray-300">Loading help content...</p>
    {:else if helpContentError}
      <p class="text-body text-red-300">{helpContentError}</p>
      <a
        class="text-body text-accent-500 underline decoration-accent-500/60 underline-offset-4 hover:text-accent-400"
        href={helpDocUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open documentation
      </a>
    {:else}
      <article
        class="text-body text-gray-200 space-y-3 [&_h1]:text-title [&_h1]:text-gray-100 [&_h2]:text-subtitle [&_h2]:text-gray-100 [&_h3]:text-subtitle [&_h3]:text-gray-200 [&_p]:leading-relaxed [&_a]:text-accent-500 [&_a]:underline [&_a]:decoration-accent-500/60 [&_a]:underline-offset-4 [&_a:hover]:text-accent-400 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1.5 [&_code]:font-mono [&_code]:rounded [&_code]:bg-gray-900 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-gray-900 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0"
      >
        {@html helpContentHtml}
      </article>
    {/if}
  </div>
</div>
