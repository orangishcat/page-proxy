<script lang="ts">
  import {onMount} from 'svelte';
  import {browser} from 'wxt/browser';
  import {Copy, MousePointer, Plus} from 'lucide-svelte';

  import Button from '../../lib/components/Button.svelte';
  import type {ElementInfo, SelectToolMessage} from '@/lib/selection';

  let selectionMode = $state(false);
  let hoveredInfo = $state<null | ElementInfo>(null);
  let selectedInfo = $state<null | ElementInfo>(null);
  let errorMessage = $state<string | null>(null);

  const selectionButtonClasses = $derived(
    selectionMode
      ? 'bg-accent-400 text-gray-950 hover:bg-accent-300 dark:bg-accent-400 dark:text-gray-950 dark:hover:bg-accent-300'
      : 'bg-gray-800 text-gray-200 hover:bg-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
  );

  const formatBoundingBox = (box: ElementInfo['boundingBox']) =>
    `${box.width.toFixed(2)} × ${box.height.toFixed(2)} @ ${box.x.toFixed(2)}, ${box.y.toFixed(2)}`;

  const isRestrictedUrl = (url: string | undefined) => {
    if (!url) {
      return true;
    }

    const normalized = url.toLowerCase();
    return (
      normalized.startsWith('chrome://') ||
      normalized.startsWith('brave://') ||
      normalized.startsWith('edge://') ||
      normalized.startsWith('about:') ||
      normalized.startsWith('chrome-extension://') ||
      normalized.startsWith('moz-extension://') ||
      normalized.startsWith('view-source:')
    );
  };

  const injectSelectTool = (tabId: number) =>
    browser.scripting.executeScript({
      target: {tabId, allFrames: true},
      files: ['content-scripts/select-tool.js']
    });

  const sendSelectionToggle = (enabled: boolean) => {
    const shouldReportError = enabled;
    errorMessage = null;

    void browser.tabs
      .query({active: true, currentWindow: true})
      .then((tabs) => {
        const activeTab = tabs[0];
        const tabId = activeTab?.id;
        if (tabId === undefined) {
          if (shouldReportError) {
            selectionMode = false;
            hoveredInfo = null;
            errorMessage = 'No active tab found.';
          }
          return;
        }

        if (shouldReportError && isRestrictedUrl(activeTab?.url)) {
          selectionMode = false;
          hoveredInfo = null;
          errorMessage = 'Selection is unavailable on this page.';
          return;
        }

        return browser.tabs
          .sendMessage(tabId, {
            type: 'select:toggle',
            enabled
          } satisfies SelectToolMessage)
          .catch(() => {
            if (!shouldReportError) {
              return;
            }

            return injectSelectTool(tabId)
              .then(() =>
                browser.tabs.sendMessage(tabId, {
                  type: 'select:toggle',
                  enabled
                } satisfies SelectToolMessage)
              )
              .catch(() => {
                selectionMode = false;
                hoveredInfo = null;
                errorMessage = 'Unable to connect to the active tab.';
              });
          });
      })
      .catch(() => {
        if (!shouldReportError) {
          return;
        }

        selectionMode = false;
        hoveredInfo = null;
        errorMessage = 'Unable to connect to the active tab.';
      });
  };

  const toggleSelectionMode = () => {
    selectionMode = !selectionMode;
    if (!selectionMode) {
      hoveredInfo = null;
    }

    sendSelectionToggle(selectionMode);
  };

  const copyToClipboard = (value: string) => {
    if (!navigator.clipboard) {
      errorMessage = 'Clipboard access is unavailable.';
      return;
    }
    void navigator.clipboard.writeText(value);
  };

  onMount(() => {
    const listener = (message: SelectToolMessage) => {
      if (message.type === 'select:hover') {
        if (selectionMode) {
          hoveredInfo = message.payload;
        }
        return;
      }

      if (message.type === 'select:selected') {
        selectedInfo = message.payload;
        errorMessage = null;
      }
    };

    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  });
</script>

<main class="min-h-screen bg-gray-950 text-gray-100">
  <div class="flex h-screen flex-col border-2 border-gray-800">
    <section
      class="flex min-h-0 flex-1 flex-col bg-gray-900 p-4 shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.4)]"
    >
      <div class="flex items-center justify-start gap-2 pb-4">
        <Button
          variant="outline"
          class={`h-10 w-10 ${selectionButtonClasses}`}
          aria-label="Toggle element selection mode"
          aria-pressed={selectionMode}
          onclick={toggleSelectionMode}
        >
          <MousePointer class="h-5 w-5"/>
        </Button>
        <Button
          variant="outline"
          class="h-10 w-10 bg-secondary-400 text-gray-950 hover:bg-secondary-300 dark:bg-secondary-400 dark:text-gray-950 dark:hover:bg-secondary-300"
          aria-label="Add element"
        >
          <Plus class="h-5 w-5"/>
        </Button>
      </div>
      {#if errorMessage}
        <p class="text-caption text-red-300 pb-3">{errorMessage}</p>
      {/if}
      <div class="flex-1 min-h-0 text-sm text-gray-300">
        <div class="flex h-[30%] min-h-0 flex-col">
          <p class="text-label text-gray-500">Hovering</p>
          <div class="mt-2 flex-1 min-h-0 overflow-y-auto">
            {#if hoveredInfo}
              <div class="space-y-2">
                <p class="text-body text-gray-200">{hoveredInfo.tag}</p>
                <div class="text-caption text-gray-400">
                  {#if hoveredInfo.id}
                    <p>ID: {hoveredInfo.id}</p>
                  {/if}
                  {#if hoveredInfo.name}
                    <p>Name: {hoveredInfo.name}</p>
                  {/if}
                  {#if hoveredInfo.className}
                    <p>Class: {hoveredInfo.className}</p>
                  {/if}
                  <p>Selector: {hoveredInfo.selector}</p>
                  <p>Box: {formatBoundingBox(hoveredInfo.boundingBox)}</p>
                </div>
              </div>
            {:else}
              <p class="text-caption text-gray-500">Hover an element to preview.</p>
            {/if}
          </div>
        </div>
        <div class="flex h-[70%] min-h-0 flex-col">
          <p class="text-label text-gray-500">Selected</p>
          <div class="mt-2 flex-1 min-h-0 overflow-y-auto">
            {#if selectedInfo}
              <div class="space-y-2">
                <p class="text-body text-gray-200">{selectedInfo.tag}</p>
                <div class="text-caption text-gray-400">
                  {#if selectedInfo.id}
                    <p>ID: {selectedInfo.id}</p>
                  {/if}
                  {#if selectedInfo.name}
                    <p>Name: {selectedInfo.name}</p>
                  {/if}
                  {#if selectedInfo.className}
                    <p>Class: {selectedInfo.className}</p>
                  {/if}
                  <div class="flex items-center justify-between gap-3">
                    <p>Selector: {selectedInfo.selector ?? 'Selector generation failed'}</p>
                    <button
                      class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-800 text-gray-400 transition hover:border-gray-600 hover:text-gray-200"
                      type="button"
                      aria-label="Copy selector"
                      onclick={() => {
                        if (selectedInfo && selectedInfo.selector)
                          copyToClipboard(selectedInfo.selector);
                      }}
                    >
                      <Copy class="h-3.5 w-3.5"/>
                    </button>
                  </div>
                  <div class="flex items-center justify-between gap-3">
                    <p>Box: {formatBoundingBox(selectedInfo.boundingBox)}</p>
                    <button
                      class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-800 text-gray-400 transition hover:border-gray-600 hover:text-gray-200"
                      type="button"
                      aria-label="Copy bounding box"
                      onclick={() => {
                        if (selectedInfo && selectedInfo.boundingBox)
                          copyToClipboard(formatBoundingBox(selectedInfo.boundingBox));
                      }}
                    >
                      <Copy class="h-3.5 w-3.5"/>
                    </button>
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-caption text-gray-500">Select an element to lock details.</p>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <section
      class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-900 shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.4)]"
    >
      <div class="flex-1 min-h-0">
        <div class="h-full w-full bg-gray-950/70 text-body text-gray-200"></div>
      </div>
    </section>
  </div>
</main>
