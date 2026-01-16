<script lang="ts">
  import {onDestroy, onMount} from 'svelte';
  import {get} from 'svelte/store';
  import {browser} from 'wxt/browser';
  import {EditorState} from '@codemirror/state';
  import {EditorView, keymap} from '@codemirror/view';
  import {indentWithTab} from '@codemirror/commands';
  import {javascript} from '@codemirror/lang-javascript';
  import {autocompletion, type CompletionSource} from '@codemirror/autocomplete';
  import {tags as t} from '@lezer/highlight';
  import {
    HighlightStyle,
    indentRange,
    indentUnit,
    syntaxHighlighting
  } from '@codemirror/language';
  import {ExternalLink, Play} from 'lucide-svelte';

  import {pageModificationFunctions} from '@/lib/page-modification';
  import Button from '@/lib/components/Button.svelte';
  import {parseScriptMetadata} from '@/lib/utils/script-metadata';
  import {
    requestSandboxEvaluation,
    requestScriptRun
  } from './sandbox/actions';
  import {
    elementEntries,
    scriptMetadata,
    setEditorApi,
    selectorEntries
  } from './code-editor/state';
  import type {ScriptMetadataState} from './code-editor/state';
  import {errorMessage, setErrorMessage} from './tool-errors';

  const defineBlockStart = '// Define elements/selectors';
  const defineBlockEnd = '// End define elements/selectors';
  const editorStorageKey = 'page-proxy:sidepanel:script';
  const editorTheme = EditorView.theme({
    '&': {
      color: '#5c6e74',
      backgroundColor: '#282824',
      fontSize: '0.8125rem',
      fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace",
      lineHeight: '1.5',
      textShadow: 'none'
    },
    '.cm-content': {
      caretColor: '#5c6e74'
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: '#b3d4fc'
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: '#b3d4fc'
    },
    '.cm-cursor': {
      borderLeftColor: '#5c6e74'
    },
    '.cm-gutters': {
      backgroundColor: '#282824',
      color: '#5c6e74',
      border: 'none'
    }
  });
  const selectorHighlightStyle = HighlightStyle.define([
    {tag: t.comment, color: '#93a1a1'},
    {tag: t.punctuation, color: '#999999'},
    {tag: [t.propertyName, t.tagName, t.bool, t.number, t.constant(t.name), t.constant(t.variableName), t.deleted], color: '#990055'},
    {tag: [t.attributeName, t.string, t.character, t.standard(t.name), t.inserted], color: '#669900'},
    {tag: [t.operator, t.url], color: '#a67f59'},
    {tag: [t.keyword, t.attributeValue, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: '#0077aa'},
    {tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dd4a68'},
    {tag: [t.regexp, t.variableName, t.atom], color: '#ee9900'},
    {tag: t.strong, fontWeight: '700'},
    {tag: t.emphasis, fontStyle: 'italic'}
  ]);

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let editorValue = $state('');
  let saveTimer: number | null = null;
  let sandboxSyncTimer: number | null = null;
  let pendingSandboxContent: string | null = null;
  let isRunning = $state(false);
  let scriptMetadataValue = $state<ScriptMetadataState>({
    title: 'Page Proxy',
    website: '',
    description: ''
  });

  const unsubscribeScriptMetadata = scriptMetadata.subscribe((value) => {
    scriptMetadataValue = value;
  });

  const defaultScript = [
    '// ==Page Proxy==',
    '// @title Page Proxy',
    '// @website',
    '// @description',
    '// ==/Page Proxy==',
    '',
    defineBlockStart,
    defineBlockEnd,
    ''
  ].join('\n');

  const baseSuggestions = ['pp.element', 'pp.selector', ...pageModificationFunctions];

  const updateScriptMetadata = (content: string) => {
    const metadata = parseScriptMetadata(content);
    if (!metadata) {
      scriptMetadata.set({
        title: 'Page Proxy',
        website: '',
        description: ''
      });
      return;
    }
    scriptMetadata.set({
      title: metadata.title || 'Page Proxy',
      website: metadata.website,
      description: metadata.description
    });
  };

  const buildSuggestions = () =>
    Array.from(new Set(baseSuggestions)).map((label) => ({
      label,
      type: label.startsWith('pp') ? 'function' : 'property'
    }));

  const suggestionSource: CompletionSource = (context) => {
    const word = context.matchBefore(/[\w$.]+/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    const options = buildSuggestions().filter((suggestion) =>
      suggestion.label.startsWith(word.text)
    );
    return {from: word.from, options};
  };

  const ensureDefineBlock = (content: string) => {
    const lines = content.split('\n');
    const startIndex = lines.findIndex((line) => line.trim() === defineBlockStart);
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return content;
    }

    return [content.trimEnd(), '', defineBlockStart, defineBlockEnd, ''].join('\n');
  };

  let lastSandboxError = $state<string | null>(null);
  let lastRunError = $state<string | null>(null);
  let sandboxRequestId = $state(0);

  const getDefinitionBlock = (content: string) => {
    const lines = content.split('\n');
    const startIndex = lines.findIndex((line) => line.trim() === defineBlockStart);
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return '';
    }

    return lines.slice(startIndex + 1, endIndex).join('\n');
  };

  const updateSandboxError = (errors: string[]) => {
    if (errors.length === 0) {
      if (lastSandboxError && get(errorMessage) === lastSandboxError) {
        setErrorMessage(null);
      }
      lastSandboxError = null;
      return;
    }

    const message = errors[0];
    lastSandboxError = message;
    setErrorMessage(message);
  };

  const formatIndentation = (content: string) => {
    if (!content.trim()) {
      return content;
    }

    const state = EditorState.create({
      doc: content,
      extensions: [javascript({typescript: false}), indentUnit.of('  ')]
    });
    const changes = indentRange(state, 0, state.doc.length);
    return changes.empty ? content : changes.apply(state.doc).toString();
  };

  const syncDefinitionsNow = (content: string) => {
    const definitionBlock = getDefinitionBlock(content);
    const formattedDefinition = formatIndentation(definitionBlock);
    if (!formattedDefinition.trim()) {
      updateSandboxError([]);
      elementEntries.set([]);
      selectorEntries.set([]);
      return;
    }

    const requestId = ++sandboxRequestId;
    void requestSandboxEvaluation(formattedDefinition).then((result) => {
      if (requestId !== sandboxRequestId) {
        return;
      }

      updateSandboxError(result.errors);
      elementEntries.set(result.elements);
      selectorEntries.set(result.selectors);
    });
  };

  const syncDefinitions = (content: string) => {
    pendingSandboxContent = content;

    if (sandboxSyncTimer) {
      window.clearTimeout(sandboxSyncTimer);
    }

    sandboxSyncTimer = window.setTimeout(() => {
      const latestContent = pendingSandboxContent ?? '';
      pendingSandboxContent = null;
      sandboxSyncTimer = null;
      syncDefinitionsNow(latestContent);
    }, 1000);
  };

  const updateRunError = (errors: string[]) => {
    if (errors.length === 0) {
      if (lastRunError && get(errorMessage) === lastRunError) {
        setErrorMessage(null);
      }
      lastRunError = null;
      return;
    }

    const message = errors[0];
    lastRunError = message;
    setErrorMessage(message);
  };

  const runScript = () => {
    if (isRunning) {
      return;
    }

    if (!editorValue.trim()) {
      setErrorMessage('Script is empty.');
      return;
    }

    isRunning = true;
    const formattedScript = formatIndentation(editorValue);
    void requestScriptRun(formattedScript)
      .then((result) => {
        updateRunError(result.errors);
      })
      .finally(() => {
        isRunning = false;
      });
  };

  const updateEditorContent = (content: string) => {
    editorValue = content;
    updateScriptMetadata(content);
    syncDefinitions(content);

    if (editorView) {
      editorView.dispatch({
        changes: {from: 0, to: editorView.state.doc.length, insert: content}
      });
    }

    queueStorageSave(content);
  };

  const queueStorageSave = (content: string) => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }

    saveTimer = window.setTimeout(() => {
      void browser.storage.local
        .set({[editorStorageKey]: content})
        .catch(() => {
          setErrorMessage('Unable to save script to extension storage.');
        });
    }, 300);
  };

  const insertDefinitionLines = (linesToInsert: string[]) => {
    const content = ensureDefineBlock(editorValue);
    const lines = content.split('\n');
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (endIndex === -1) {
      updateEditorContent(content);
      return;
    }

    lines.splice(endIndex, 0, ...linesToInsert, '');
    updateEditorContent(lines.join('\n'));
  };

  const loadEditorFromStorage = () => {
    void browser.storage.local
      .get(editorStorageKey)
      .then((result) => {
        const stored = result[editorStorageKey];
        if (typeof stored === 'string' && stored.trim().length > 0) {
          editorValue = ensureDefineBlock(stored);
        } else {
          editorValue = defaultScript;
        }
        updateScriptMetadata(editorValue);
        syncDefinitions(editorValue);
        if (editorView) {
          editorView.dispatch({
            changes: {from: 0, to: editorView.state.doc.length, insert: editorValue}
          });
        }
      })
      .catch(() => {
        editorValue = defaultScript;
        updateScriptMetadata(editorValue);
        syncDefinitions(editorValue);
        setErrorMessage('Unable to load saved script from extension storage.');
      });
  };

  const setupEditor = () => {
    if (!editorHost || editorView) {
      return;
    }
    const state = EditorState.create({
      doc: editorValue,
      extensions: [
        javascript({typescript: false}),
        editorTheme,
        syntaxHighlighting(selectorHighlightStyle, {fallback: true}),
        keymap.of([indentWithTab]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            editorValue = update.state.doc.toString();
            updateScriptMetadata(editorValue);
            syncDefinitions(editorValue);
            queueStorageSave(editorValue);
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

  onMount(() => {
    editorValue = defaultScript;
    loadEditorFromStorage();
    setupEditor();
    setEditorApi({insertDefinitions: insertDefinitionLines});

    return () => {
      setEditorApi(null);
    };
  });

  onDestroy(() => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }

    if (sandboxSyncTimer) {
      window.clearTimeout(sandboxSyncTimer);
    }

    if (editorView) {
      editorView.destroy();
      editorView = null;
    }

    unsubscribeScriptMetadata();
  });
</script>

<section
  class="relative h-[63.44%] w-full bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
  aria-label="Code editor panel"
>
  <div class="h-8 w-full bg-[#393a34] flex items-center justify-between px-4">
    <div>
      <span class="text-body">{scriptMetadataValue.title}</span>
      {#if scriptMetadataValue.website}
        <span class="pp-editor-title-muted"> @ </span>
        <span class="pp-editor-title-accent">{scriptMetadataValue.website}</span>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      <Button
        class="!px-3 !py-1 text-xs"
        variant="secondary"
        aria-label="Run script"
        onclick={runScript}
        disabled={isRunning}
      >
        <Play class="h-4 w-4" />
      </Button>
      <ExternalLink class="w-6 h-6 text-[#a8a8a8]" />
    </div>
  </div>
  <div class="h-full w-full overflow-auto" bind:this={editorHost}></div>
</section>
