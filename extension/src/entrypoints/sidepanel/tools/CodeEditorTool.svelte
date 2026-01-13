<script lang="ts">
  import {onDestroy, onMount} from 'svelte';
  import {browser} from 'wxt/browser';
  import {EditorState} from '@codemirror/state';
  import {EditorView, keymap} from '@codemirror/view';
  import {indentWithTab} from '@codemirror/commands';
  import {esLint, javascript} from '@codemirror/lang-javascript';
  import {autocompletion, type CompletionSource} from '@codemirror/autocomplete';
  import {defaultHighlightStyle, syntaxHighlighting} from '@codemirror/language';
  import {linter, lintGutter} from '@codemirror/lint';
  import {Linter} from 'eslint-linter-browserify';
  import {ExternalLink} from 'lucide-svelte';

  import {pageModificationFunctions} from '@/lib/page-modification';
  import {parseScriptMetadata} from '@/lib/utils/script-metadata';
  import {
    elementEntries,
    scriptMetadata,
    setEditorApi,
    styleEntries
  } from './code-editor/state';
  import type {ElementEntry, ScriptMetadataState, StyleEntry} from './code-editor/state';
  import type {BoundingBox} from './select-tool/state';
  import {setErrorMessage} from './tool-errors';

  const defineBlockStart = '// Define elements/styles';
  const defineBlockEnd = '// End define elements/styles';
  const editorStorageKey = 'page-proxy:sidepanel:script';

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let editorValue = $state('');
  let saveTimer: number | null = null;
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

  const pageModificationGlobals = Object.fromEntries(
    pageModificationFunctions.map((name) => [name, 'readonly'])
  );

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
    'element.dataset',
    'pp',
    'pp.element',
    'pp.style',
    ...pageModificationFunctions
  ];

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

  const parseBoundingBoxValue = (value: string): BoundingBox | null => {
    const parts = value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isFinite(part));

    if (parts.length !== 4) {
      return null;
    }

    return {
      x: parts[0],
      y: parts[1],
      width: parts[2],
      height: parts[3]
    };
  };

  const parseDefinitionTokens = (line: string) => {
    const tokenRegex = /([a-zA-Z0-9:_-]+)="([^"]*)"/g;
    return Array.from(line.matchAll(tokenRegex)).map((match) => ({
      key: match[1],
      value: match[2]
    }));
  };

  const parseDefinitionsFromContent = (content: string) => {
    const lines = content.split('\n');
    const startIndex = lines.findIndex((line) => line.trim() === defineBlockStart);
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return {elements: [], styles: []};
    }

    const elements: ElementEntry[] = [];
    const styles: StyleEntry[] = [];

    lines.slice(startIndex + 1, endIndex).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('// pp:element')) {
        const tokens = parseDefinitionTokens(trimmed);
        const attributes: Record<string, string> = {};
        let name = '';
        let selector = '';
        let bbox: BoundingBox | null = null;

        tokens.forEach(({key, value}) => {
          if (key === 'name') {
            name = value;
            return;
          }
          if (key === 'selector') {
            selector = value;
            return;
          }
          if (key === 'bbox') {
            bbox = parseBoundingBoxValue(value);
            return;
          }
          if (key.startsWith('attr:')) {
            attributes[key.replace('attr:', '')] = value;
          }
        });

        if (name || selector) {
          elements.push({
            name: name || 'Element',
            selector,
            bbox: bbox ?? {x: 0, y: 0, width: 0, height: 0},
            attributes
          });
        }
      }

      if (trimmed.startsWith('// pp:style')) {
        const tokens = parseDefinitionTokens(trimmed);
        const properties: Record<string, string> = {};
        let name = '';
        let selector = '';
        let bbox: BoundingBox | null = null;

        tokens.forEach(({key, value}) => {
          if (key === 'name') {
            name = value;
            return;
          }
          if (key === 'selector') {
            selector = value;
            return;
          }
          if (key === 'bbox') {
            bbox = parseBoundingBoxValue(value);
            return;
          }
          if (key.startsWith('prop:')) {
            properties[key.replace('prop:', '')] = value;
          }
        });

        if (name || selector) {
          styles.push({
            name: name || 'Style',
            selector,
            bbox: bbox ?? undefined,
            properties
          });
        }
      }
    });

    return {elements, styles};
  };

  const syncDefinitions = (content: string) => {
    const parsed = parseDefinitionsFromContent(content);
    elementEntries.set(parsed.elements);
    styleEntries.set(parsed.styles);
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
    const eslintConfig = [
      {
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: 'script',
          globals: {
            window: 'readonly',
            document: 'readonly',
            navigator: 'readonly',
            console: 'readonly',
            ...pageModificationGlobals
          }
        },
        rules: {
          'no-undef': 'error',
          'no-unused-vars': [
            'warn',
            {
              vars: 'all',
              args: 'none',
              ignoreRestSiblings: true
            }
          ],
          'no-console': 'off'
        }
      }
    ];
    const eslintLinter = new Linter();
    const state = EditorState.create({
      doc: editorValue,
      extensions: [
        javascript({typescript: false}),
        syntaxHighlighting(defaultHighlightStyle),
        lintGutter(),
        linter(esLint(eslintLinter, eslintConfig)),
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
  <div class="absolute left-0 top-0 h-[7.71%] w-full bg-[#393a34]">
    <div class="absolute left-[4.25%] top-[21.59%]">
      <span class="pp-editor-title">{scriptMetadataValue.title}</span>
      {#if scriptMetadataValue.website}
        <span class="pp-editor-title-muted"> @ </span>
        <span class="pp-editor-title-accent">{scriptMetadataValue.website}</span>
      {/if}
    </div>
    <ExternalLink class="absolute left-[92.25%] top-[22.73%] h-[45.45%] w-[5%] text-[#a8a8a8]" />
  </div>
  <div class="absolute left-[5.13%] top-[7.18%] h-[82.31%] w-[92%]">
    <div class="h-full w-full" bind:this={editorHost}></div>
  </div>
</section>
