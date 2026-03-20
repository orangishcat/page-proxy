<script lang="ts">
  import Button from "@/lib/components/Button.svelte";
  import type { ScriptGrantValue } from "@/lib/grants";
  import ModalOverlay from "./ModalOverlay.svelte";
  import { POPUP_SHARED_CLASS, POPUP_SHARED_STYLE } from "./popup/container-shared";

  type Props = {
    scriptName: string;
    grants: ScriptGrantValue[];
    onResolve: (allow: boolean) => Promise<void>;
    onClose: () => void;
  };

  let { scriptName, grants, onResolve, onClose }: Props = $props();

  let isResolving = $state(false);
  let errorMessage = $state<string | null>(null);

  const resolve = async (allow: boolean) => {
    if (isResolving) return;
    isResolving = true;
    errorMessage = null;
    try {
      await onResolve(allow);
      onClose();
    } catch {
      errorMessage = "Unable to update grant permissions.";
    } finally {
      isResolving = false;
    }
  };
</script>

<ModalOverlay>
  <div
    class={`${POPUP_SHARED_CLASS} w-full max-w-sm space-y-3 rounded-2xl p-4`}
    style={POPUP_SHARED_STYLE}
  >
    <h2 class="text-title text-gray-100">Grant permissions</h2>
    <p class="text-body text-gray-300">
      <span class="font-medium text-gray-100">{scriptName}</span> is requesting the following permissions:
    </p>
    <ul class="list-disc pl-4 space-y-1.5 text-gray-200">
      {#each grants as grant (`${scriptName}-${grant}`)}
        <li>
          {#if grant === "run-on-page-load"}
            <a
              class="text-accent-500 underline decoration-accent-500/60 underline-offset-4 hover:text-accent-400"
              href="https://orangishcat.github.io/page-proxy/docs/permissions#grant-run-on-page-load"
              target="_blank"
              rel="noopener noreferrer"
            >
              {grant}
            </a>
          {:else}
            <span>{grant}</span>
          {/if}
        </li>
      {/each}
    </ul>
    {#if errorMessage}
      <p class="text-body text-red-400">{errorMessage}</p>
    {/if}
    <div class="flex items-center justify-end gap-2">
      <button
        type="button"
        class="rounded-xl border border-gray-500 bg-gray-700 px-3 py-1.5 text-button text-gray-200 transition hover:opacity-80 active:opacity-60 disabled:opacity-50"
        onclick={() => resolve(false)}
        disabled={isResolving}
      >
        Deny
      </button>
      <Button
        variant="primary"
        class="px-3! py-1.5!"
        onclick={() => resolve(true)}
        disabled={isResolving}
      >
        Allow
      </Button>
    </div>
  </div>
</ModalOverlay>
