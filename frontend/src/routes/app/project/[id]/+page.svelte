<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Navbar from '$lib/components/Navbar.svelte';
  import {getFile, isResultError} from '$lib/data/files';
  import previewTemplate from '$lib/preview/preview-document.html?raw';
  import {MousePointer, Plus} from 'lucide-svelte';
  import {WindowMessenger, connect, type RemoteProxy} from 'penpal';
  import penpalBundle from '$lib/preview/penpal.min.js?raw';
  import {page} from '$app/stores';
  import {onDestroy, onMount} from 'svelte';
  import {EditorState} from '@codemirror/state';
  import {EditorView} from '@codemirror/view';
  import {javascript} from '@codemirror/lang-javascript';
  import {autocompletion, type CompletionSource} from '@codemirror/autocomplete';
  import {parseScriptMetadata} from '$lib/utils/script-metadata';

  const safePenpalBundle = penpalBundle.replace(/<\/script>/g, '<\\/script>');
  const previewDocument = $derived(
    previewTemplate.replace('__PENPAL_BUNDLE__', safePenpalBundle)
  );
  let selectionMode = $state(false);
  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let hoveredInfo = $state<null | ElementInfo>(null);
  let selectedInfo = $state<null | ElementInfo>(null);
  let fileTitle = $state('Page Proxy');
  let fileWebsite = $state('');
  let fileDescription = $state('');
  let errorMessage = $state<string | null>(null);

  let editorValue = $state('');
  let editorHost = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let newSuggestion = $state('');
  let customSuggestions = $state<string[]>([
    'querySelector',
    'querySelectorAll',
    'classList',
    'addEventListener',
    'removeEventListener',
    'fetch',
    'localStorage',
    'getBoundingClientRect',
    'setTimeout',
    'setInterval'
  ]);
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
    fileWebsite = metadata?.website || '';
    fileDescription = metadata?.description || '';
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

  const buildSuggestions = () => {
    const unique = Array.from(new Set([...customSuggestions, ...baseSuggestions]));
    return unique.map((label) => ({label, type: 'property'}));
  };

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

  const addSuggestion = () => {
    const value = newSuggestion.trim();
    if (!value) {
      return;
    }
    customSuggestions = [...customSuggestions, value];
    newSuggestion = '';
    if (editorView) {
      editorView.focus();
    }
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
  <div class="mx-auto flex min-h-screen w-full flex-col gap-6 px-16 py-8">
    <div class="flex justify-center">
      <Navbar variant="app" />
    </div>

    <section class="grid flex-1 h-full items-center gap-6 lg:grid-cols-[2.1fr_1fr]">
      <div class="h-full overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-[0_1.2rem_2.4rem_rgba(0,0,0,0.45)]">
        <div class="flex h-full w-full flex-col">
          <div class="flex items-center justify-between border-b border-gray-800 px-6 py-4">
            <div>
              <div class="text-label text-gray-500">Website display</div>
              <div class="text-body text-gray-300">
                {fileWebsite || 'No website set.'}
              </div>
            </div>
            <Button variant="primary" class="h-10 px-6">
              Export
            </Button>
          </div>
          <div class="flex-1 min-h-0">
            <iframe
              class="h-full w-full"
              title="Website preview"
              bind:this={iframeEl}
              onload={() => {
                initializePenpal();
              }}
              srcdoc={previewDocument}
              sandbox="allow-same-origin allow-scripts allow-forms"
            ></iframe>
          </div>
        </div>
      </div>

      <div class="flex h-full flex-col gap-6">
        <div class="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.4)]">
          <div class="flex items-center justify-between border-b border-gray-800 pb-4">
            <div>
              <div class="text-label text-gray-500">Tool info</div>
              <div class="text-body text-gray-300">{fileTitle}</div>
            </div>
            <div class="flex items-center gap-2">
              <Button
                variant="accent"
                class={`h-10 w-10 ${selectionButtonClasses}`}
                aria-label="Toggle element selection mode"
                aria-pressed={selectionMode}
                onclick={toggleSelectionMode}
              >
                <MousePointer class="h-5 w-5" />
              </Button>
              <Button
                variant="accent"
                class="h-10 w-10 bg-secondary-400 text-gray-950 hover:bg-secondary-300 dark:bg-secondary-400 dark:text-gray-950 dark:hover:bg-secondary-300"
                aria-label="Add element"
              >
                <Plus class="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div class="mt-4 space-y-4 text-sm text-gray-300">
            {#if fileDescription}
              <p class="text-body text-gray-300">{fileDescription}</p>
            {/if}
            <div>
              <p class="text-label text-gray-500">Hovering</p>
              {#if hoveredInfo}
                <p class="text-body text-gray-200">{hoveredInfo.tag}</p>
                <p class="text-caption text-gray-400">{hoveredInfo.className ?? '—'}</p>
              {:else}
                <p class="text-caption text-gray-500">Hover an element to preview.</p>
              {/if}
            </div>
            <div>
              <p class="text-label text-gray-500">Selected</p>
              {#if selectedInfo}
                <p class="text-body text-gray-200">{selectedInfo.tag}</p>
                <p class="text-caption text-gray-400">{selectedInfo.id ?? '—'}</p>
              {:else}
                <p class="text-caption text-gray-500">Select an element to lock details.</p>
              {/if}
            </div>
            {#if errorMessage}
              <p class="text-caption text-red-300">{errorMessage}</p>
            {/if}
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-[0_1.1rem_2.2rem_rgba(0,0,0,0.4)]">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-label text-gray-500">Code editor</div>
              <div class="text-caption text-gray-500">JS with autocomplete</div>
            </div>
            <div class="flex items-center gap-2">
              <input
                class="h-9 w-40 rounded-full border border-gray-800 bg-gray-950 px-4 text-caption text-gray-200 outline-none focus:border-accent-400"
                type="text"
                placeholder="Add suggestion"
                bind:value={newSuggestion}
                onkeydown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addSuggestion();
                  }
                }}
              />
              <Button
                variant="accent"
                class="h-9 px-4 text-sm"
                onclick={addSuggestion}
              >
                Add
              </Button>
            </div>
          </div>
          <div class="mt-4 flex-1 min-h-0">
            <div
              class="h-full min-h-[14rem] w-full rounded-xl border border-gray-800 bg-gray-950/70 text-body text-gray-200"
              bind:this={editorHost}
            ></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</main>
