<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Navbar from '$lib/components/Navbar.svelte';
  import {getFile, isResultError} from '$lib/data/files';
  import {Copy, ExternalLink, Globe, MousePointer, Plus} from 'lucide-svelte';
  import {connect, type RemoteProxy, WindowMessenger} from 'penpal';
  import {page} from '$app/stores';
  import {onDestroy, onMount} from 'svelte';
  import {EditorState} from '@codemirror/state';
  import {EditorView} from '@codemirror/view';
  import {javascript} from '@codemirror/lang-javascript';
  import {autocompletion, type CompletionSource} from '@codemirror/autocomplete';
  import {parseScriptMetadata} from '$lib/utils/script-metadata';

  let selectionMode = $state(false);
  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let hoveredInfo = $state<null | ElementInfo>(null);
  let selectedInfo = $state<null | ElementInfo>(null);
  let fileTitle = $state('Page Proxy');
  let errorMessage = $state<string | null>(null);
  let websiteInput = $state('');
  let activeWebsite = $state('');

  let editorValue = $state('');
  let editorHost = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  const baseSuggestions = [
    'document',
    'window',
    'console',
    'document.body',
    'document.querySelector',
    'document.querySelectorAll',
    'document.getElementById',
    'document.createElement',
    'element.style',
    'element.classList',
    'element.dataset'
  ];

  type ElementInfo = {
    tag: string;
    id: string | null;
    name: string | null;
    className: string | null;
    selector: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };

  type ChildApi = {
    setSelectionEnabled: (enabled: boolean) => void;
  };

  const stripExtension = (name: string) =>
    name.endsWith('.js') ? name.slice(0, -3) : name;

  const truncateTitle = (title: string) =>
    title.length > 18 ? `${title.slice(0, 18).trimEnd()}...` : title;

  const resolvedTitle = $derived.by(() => truncateTitle(fileTitle));
  const proxyUrl = $derived.by(() =>
    activeWebsite ? `/api/proxy?url=${encodeURIComponent(activeWebsite)}` : ''
  );

  const selectionButtonClasses = $derived(
    selectionMode
      ? 'bg-accent-400 text-gray-950 hover:bg-accent-300 dark:bg-accent-400 dark:text-gray-950 dark:hover:bg-accent-300'
      : 'bg-gray-800 text-gray-200 hover:bg-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
  );

  const toggleSelectionMode = () => {
    selectionMode = !selectionMode;
    if (!selectionMode) {
      hoveredInfo = null;
    }
    if (childApi) {
      childApi.setSelectionEnabled(selectionMode);
    }
  };

  $effect(() => {
    if (childApi) {
      childApi.setSelectionEnabled(selectionMode);
    }
  });

  let childApi = $state<RemoteProxy<ChildApi> | null>(null);
  let connection = $state<ReturnType<typeof connect> | null>(null);
  const fileId = $derived.by(() => decodeURIComponent($page.params.id ?? ''));
  const formatBoundingBox = (box: ElementInfo['boundingBox']) =>
    `${box.width.toFixed(2)} × ${box.height.toFixed(2)} @ ${box.x.toFixed(2)}, ${box.y.toFixed(2)}`;

  const loadFile = async () => {
    if (!fileId) {
      errorMessage = 'File id is missing.';
      return;
    }
    const result = await getFile(fileId);
    if (isResultError(result)) {
      errorMessage = result.error;
      return;
    }
    const metadata = parseScriptMetadata(result.value.content);
    fileTitle = metadata?.title || stripExtension(result.value.name);
    websiteInput = metadata?.website || '';
    activeWebsite = websiteInput;
    editorValue = result.value.content;
    if (editorView) {
      editorView.dispatch({
        changes: {from: 0, to: editorView.state.doc.length, insert: editorValue}
      });
    }
  };

  const initializePenpal = () => {
    if (!iframeEl || !iframeEl.contentWindow) return;
    if (connection) {
      connection.destroy();
    }
    childApi = null;
    const messenger = new WindowMessenger({
      remoteWindow: iframeEl.contentWindow
    });
    const nextConnection = connect<ChildApi>({
      messenger,
      methods: {
        handleHover(info) {
          hoveredInfo = info;
        },
        handleSelect(info) {
          selectedInfo = info;
        }
      }
    });
    connection = nextConnection;
    nextConnection.promise.then((api) => {
      childApi = api;
      api.setSelectionEnabled(selectionMode);
    });
  };

  const buildSuggestions = () =>
    Array.from(new Set(baseSuggestions)).map((label) => ({
      label,
      type: 'property'
    }));

  const suggestionSource: CompletionSource = (context) => {
    const word = context.matchBefore(/[\w$]+/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    const options = buildSuggestions().filter((suggestion) =>
      suggestion.label.startsWith(word.text)
    );
    return {from: word.from, options};
  };

  const setupEditor = () => {
    if (!editorHost || editorView) {
      return;
    }
    const state = EditorState.create({
      doc: editorValue,
      extensions: [
        javascript({typescript: false}),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            editorValue = update.state.doc.toString();
          }
        }),
        autocompletion({override: [suggestionSource]})
      ]
    });
    editorView = new EditorView({
      state,
      parent: editorHost
    });
  };

  const commitWebsite = () => {
    const nextWebsite = websiteInput.trim();
    if (nextWebsite === activeWebsite) {
      return;
    }
    activeWebsite = nextWebsite;
    hoveredInfo = null;
    selectedInfo = null;
  };

  const openWebsite = () => {
    if (!activeWebsite) {
      errorMessage = 'Enter a website url first.';
      return;
    }
    window.open(activeWebsite, '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = (value: string) => {
    if (!navigator.clipboard) {
      errorMessage = 'Clipboard access is unavailable.';
      return;
    }
    void navigator.clipboard.writeText(value);
  };

  onMount(() => {
    setupEditor();
    loadFile();
  });

  onDestroy(() => {
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
  });
</script>

<svelte:head>
  <title>{resolvedTitle}</title>
</svelte:head>

<main class="min-h-screen bg-gray-950 text-gray-100">
  <div class="mx-auto flex min-h-screen w-full flex-col gap-6 px-16 pt-6">
    <div class="flex justify-center">
      <Navbar variant="app"/>
    </div>

    <section class="grid flex-1 h-full items-center gap-6 lg:grid-cols-[2.1fr_1fr] pb-8">
      <div
        class="h-full overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-[0_1.2rem_2.4rem_rgba(0,0,0,0.45)]">
        <div class="flex h-full w-full flex-col">
          <div class="border-b border-gray-800 p-2">
            <div
              class="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 py-1 pl-4 pr-2"
            >
              <Globe class="h-5 w-5 text-gray-400"/>
              <input
                class="w-full bg-transparent text-body text-gray-200 outline-none placeholder:text-gray-600"
                type="text"
                placeholder="Enter website url"
                bind:value={websiteInput}
                onblur={commitWebsite}
                onkeydown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitWebsite();
                  }
                }}
              />
              <Button
                variant="outline"
                type="button"
                aria-label="Open website in new tab"
                onclick={openWebsite}
              >
                <ExternalLink class="h-4 w-4"/>
              </Button>
            </div>
          </div>
          <div class="flex-1 min-h-0">
            <iframe
              class="h-full w-full bg-gray-950"
              title="Website preview"
              bind:this={iframeEl}
              onload={() => {
                initializePenpal();
              }}
              src={proxyUrl}
              sandbox="allow-same-origin allow-scripts allow-forms"
            ></iframe>
          </div>
        </div>
      </div>

      <div class="flex h-full flex-col gap-6">
        <div
          class="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.4)]">
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
          <div class="h-full text-sm text-gray-300">
            <div class="h-[30%] overflow-y-auto">
              <p class="text-label text-gray-500">Hovering</p>
              {#if hoveredInfo}
                <p class="text-body text-gray-200">{hoveredInfo.tag}</p>
                <p class="text-caption text-gray-400">{hoveredInfo.className ?? '—'}</p>
              {:else}
                <p class="text-caption text-gray-500 mt-2">Hover an element to preview.</p>
              {/if}
            </div>
            <div class="h-[70%] overflow-y-auto">
              <p class="text-label text-gray-500">Selected</p>
              {#if selectedInfo}
                <div class="space-y-2">
                  <p class="text-body text-gray-200">{selectedInfo.tag}</p>
                  <div class="text-caption text-gray-400">
                    {#if selectedInfo.id}
                      <p>ID: {selectedInfo.id}</p>
                    {/if}
                    <p>Name: {selectedInfo.name ?? '—'}</p>
                    <p>Class: {selectedInfo.className ?? '—'}</p>
                    <div class="flex items-center justify-between gap-3">
                      <p>Selector: {selectedInfo.selector}</p>
                      <button
                        class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-800 text-gray-400 transition hover:border-gray-600 hover:text-gray-200"
                        type="button"
                        aria-label="Copy selector"
                        onclick={() => copyToClipboard(selectedInfo.selector)}
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
                        onclick={() =>
                          copyToClipboard(formatBoundingBox(selectedInfo.boundingBox))
                        }
                      >
                        <Copy class="h-3.5 w-3.5"/>
                      </button>
                    </div>
                  </div>
                </div>
              {:else}
                <p class="text-caption text-gray-500 mt-2">Select an element to lock details.</p>
              {/if}
            </div>
            {#if errorMessage}
              <p class="text-caption text-red-300">{errorMessage}</p>
            {/if}
          </div>
        </div>

        <div
          class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.4)]">
          <div class="flex-1 min-h-0">
            <div
              class="h-full w-full bg-gray-950/70 text-body text-gray-200"
              bind:this={editorHost}
            ></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</main>
