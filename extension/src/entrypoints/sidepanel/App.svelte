<script lang="ts">
  import {onDestroy, onMount} from 'svelte';
  import {browser} from 'wxt/browser';
  import {CircleQuestionMark, ExternalLink, MousePointer, Plus, Share} from 'lucide-svelte';
  import {EditorState} from '@codemirror/state';
  import {EditorView, keymap} from '@codemirror/view';
  import {indentWithTab} from '@codemirror/commands';
  import {esLint, javascript} from '@codemirror/lang-javascript';
  import {autocompletion, type CompletionSource} from '@codemirror/autocomplete';
  import {defaultHighlightStyle, syntaxHighlighting} from '@codemirror/language';
  import {linter, lintGutter} from '@codemirror/lint';
  import {Linter} from 'eslint-linter-browserify';

  import {pageModificationFunctions} from '@/lib/page-modification';
  import type {ElementInfo, SelectToolMessage} from '@/lib/selection';
  import {parseScriptMetadata} from '@/lib/utils/script-metadata';
  import NewElementTool from './tools/NewElementTool.svelte';
  import SaveStyleTool from './tools/SaveStyleTool.svelte';
  import SelectTool from './tools/SelectTool.svelte';
  import ShareTool from './tools/ShareTool.svelte';
  import StylesTool from './tools/StylesTool.svelte';
  import Button from "@/lib/components/Button.svelte";

  type BoundingBox = ElementInfo['boundingBox'];
  type ToolId = 'select' | 'new-element' | 'styles' | 'save-style' | 'share';

  type PropertyItem = {
    key: string;
    label: string;
    value: string;
    rawValue: string | BoundingBox;
    primary: boolean;
  };

  type ElementEntry = {
    name: string;
    selector: string;
    bbox: BoundingBox;
    attributes: Record<string, string>;
  };

  type StyleEntry = {
    name: string;
    selector: string;
    bbox?: BoundingBox;
    properties: Record<string, string>;
  };
  type StylesToolEntry = {
    name: string;
    selector: string;
    bboxText: string | null;
    propertyCount: number;
  };

  const defineBlockStart = '// Define elements/styles';
  const defineBlockEnd = '// End define elements/styles';
  const editorStorageKey = 'page-proxy:sidepanel:script';
  const toolLabels: Record<ToolId, string> = {
    select: 'Select',
    'new-element': 'New element',
    styles: 'Styles',
    'save-style': 'Save style',
    share: 'Share'
  };

  let activeTool = $state<ToolId>('select');
  let selectionMode = $state(false);
  let selectedInfo = $state<null | ElementInfo>(null);
  let errorMessage = $state<string | null>(null);
  let editorHost = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let scriptTitle = $state('Page Proxy');
  let scriptWebsite = $state('');
  let scriptDescription = $state('');
  let editorValue = $state('');
  let elementName = $state('');
  let styleName = $state('');
  let propertySelections = $state<Record<string, boolean>>({});
  let elementEntries = $state<ElementEntry[]>([]);
  let styleEntries = $state<StyleEntry[]>([]);
  let lastSelectedSelector = $state<string | null>(null);
  let saveTimer: number | null = null;

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
  const activeToolLabel = $derived(toolLabels[activeTool]);

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

  const formatBoundingBoxCompact = (box: BoundingBox) =>
    `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

  const getPrimaryPropertyItems = (info: ElementInfo): PropertyItem[] => {
    const items: PropertyItem[] = [];

    if (info.id) {
      items.push({
        key: 'id',
        label: 'ID',
        value: info.id,
        rawValue: info.id,
        primary: true
      });
    }

    if (info.className) {
      items.push({
        key: 'class',
        label: 'Class',
        value: info.className,
        rawValue: info.className,
        primary: true
      });
    }

    if (info.name) {
      items.push({
        key: 'name',
        label: 'Name',
        value: info.name,
        rawValue: info.name,
        primary: true
      });
    }

    items.push({
      key: 'bbox',
      label: 'BBox',
      value: formatBoundingBoxCompact(info.boundingBox),
      rawValue: info.boundingBox,
      primary: true
    });

    return items;
  };

  const buildPropertyList = (info: ElementInfo | null): PropertyItem[] => {
    if (!info) {
      return [];
    }

    const properties = getPrimaryPropertyItems(info);
    const reservedKeys = new Set(['id', 'class', 'name']);

    Object.entries(info.attributes)
      .filter(([key, value]) => !reservedKeys.has(key) && value.length > 0)
      .forEach(([key, value]) => {
        properties.push({
          key,
          label: key,
          value,
          rawValue: value,
          primary: false
        });
      });

    return properties;
  };

  const selectedPropertyList = $derived(buildPropertyList(selectedInfo));
  const selectToolLines = $derived.by(() => {
    if (!selectedInfo) {
      return [];
    }

    const lines: string[] = [];
    if (selectedInfo.id) {
      lines.push(`ID: ${selectedInfo.id}`);
    }
    if (selectedInfo.className) {
      lines.push(`Class: ${selectedInfo.className}`);
    }
    if (selectedInfo.name) {
      lines.push(`Name: ${selectedInfo.name}`);
    }
    lines.push(`Selector: ${selectedInfo.selector}`);
    lines.push(`BBox: ${formatBoundingBoxCompact(selectedInfo.boundingBox)}`);
    return lines;
  });
  const newElementLines = $derived.by(() => {
    if (!selectedInfo) {
      return [];
    }

    return selectedPropertyList.map((item) => `${item.label}: ${item.value}`);
  });
  const styleEntriesDisplay = $derived.by<StylesToolEntry[]>(() =>
    styleEntries.map((entry) => ({
      name: entry.name,
      selector: entry.selector,
      bboxText: entry.bbox ? formatBoundingBoxCompact(entry.bbox) : null,
      propertyCount: Object.keys(entry.properties).length
    }))
  );

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
            errorMessage = 'No active tab found.';
          }
          return;
        }

        if (shouldReportError && isRestrictedUrl(activeTab?.url)) {
          selectionMode = false;
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
                errorMessage = 'Unable to connect to the active tab.';
              });
          });
      })
      .catch(() => {
        if (!shouldReportError) {
          return;
        }

        selectionMode = false;
        errorMessage = 'Unable to connect to the active tab.';
      });
  };

  const setActiveTool = (tool: ToolId) => {
    activeTool = tool;
    if (tool !== 'select' && selectionMode) {
      selectionMode = false;
      sendSelectionToggle(false);
    }
  };

  const toggleSelectionMode = () => {
    activeTool = 'select';
    selectionMode = !selectionMode;
    sendSelectionToggle(selectionMode);
  };

  const updateScriptMetadata = (content: string) => {
    const metadata = parseScriptMetadata(content);
    if (!metadata) {
      scriptTitle = 'Page Proxy';
      scriptWebsite = '';
      scriptDescription = '';
      return;
    }
    scriptTitle = metadata.title || 'Page Proxy';
    scriptWebsite = metadata.website;
    scriptDescription = metadata.description;
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
    elementEntries = parsed.elements;
    styleEntries = parsed.styles;
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
          errorMessage = 'Unable to save script to extension storage.';
        });
    }, 300);
  };

  const buildDefinitionComment = (
    prefix: 'element' | 'style',
    name: string,
    selector: string,
    bbox: BoundingBox | null,
    entries: Record<string, string>,
    entryPrefix: 'attr' | 'prop'
  ) => {
    const encoded = (value: string) => value.replace(/"/g, "'");
    const baseParts = [
      `// pp:${prefix} name="${encoded(name)}"`,
      `selector="${encoded(selector)}"`
    ];

    if (bbox) {
      baseParts.push(`bbox="${formatBoundingBoxCompact(bbox)}"`);
    }

    Object.entries(entries).forEach(([key, value]) => {
      baseParts.push(`${entryPrefix}:${key}="${encoded(value)}"`);
    });

    return baseParts.join(' ');
  };

  const buildElementDefinition = (info: ElementInfo, name: string): ElementEntry => ({
    name,
    selector: info.selector,
    bbox: info.boundingBox,
    attributes: info.attributes
  });

  const buildStyleDefinition = (
    info: ElementInfo,
    name: string,
    selectedProperties: PropertyItem[]
  ): StyleEntry => {
    const properties: Record<string, string> = {};
    let bbox: BoundingBox | null = null;

    selectedProperties.forEach((item) => {
      if (item.key === 'bbox' && typeof item.rawValue !== 'string') {
        bbox = item.rawValue;
        properties[item.key] = formatBoundingBoxCompact(item.rawValue);
        return;
      }

      properties[item.key] = item.value;
    });

    return {
      name,
      selector: info.selector,
      bbox: bbox ?? undefined,
      properties
    };
  };

  const formatElementCode = (entry: ElementEntry, variableName: string) => {
    const payload = {
      name: entry.name,
      selector: entry.selector,
      bbox: entry.bbox,
      attributes: entry.attributes
    };

    return `const ${variableName} = pp.element(${JSON.stringify(payload, null, 2)});`;
  };

  const formatStyleCode = (entry: StyleEntry, variableName: string) => {
    const payload = {
      name: entry.name,
      selector: entry.selector,
      bbox: entry.bbox,
      properties: entry.properties
    };

    return `const ${variableName} = pp.style(${JSON.stringify(payload, null, 2)});`;
  };

  const insertDefinitions = (linesToInsert: string[]) => {
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

  const saveElementDefinition = () => {
    if (!selectedInfo) {
      return;
    }

    const entry = buildElementDefinition(selectedInfo, elementName.trim() || 'Element');
    const index = elementEntries.length + 1;
    const variableName = `element_${index}`;

    const commentLine = buildDefinitionComment(
      'element',
      entry.name,
      entry.selector,
      entry.bbox,
      entry.attributes,
      'attr'
    );

    const codeLine = formatElementCode(entry, variableName);

    insertDefinitions([commentLine, codeLine]);
    elementName = `element-${index + 1}`;
  };

  const saveStyleDefinition = () => {
    if (!selectedInfo) {
      return;
    }

    const selectedProperties = selectedPropertyList.filter(
      (item) => propertySelections[item.key]
    );

    if (selectedProperties.length === 0) {
      errorMessage = 'Select at least one property to save a style.';
      return;
    }

    const entry = buildStyleDefinition(
      selectedInfo,
      styleName.trim() || 'Style',
      selectedProperties
    );

    const index = styleEntries.length + 1;
    const variableName = `style_${index}`;

    const commentLine = buildDefinitionComment(
      'style',
      entry.name,
      entry.selector,
      entry.bbox ?? null,
      entry.properties,
      'prop'
    );

    const codeLine = formatStyleCode(entry, variableName);

    insertDefinitions([commentLine, codeLine]);
    styleName = `Style ${index + 1}`;
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
        errorMessage = 'Unable to load saved script from extension storage.';
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

  $effect(() => {
    if (!selectedInfo) {
      propertySelections = {};
      return;
    }

    const nextSelections: Record<string, boolean> = {};
    selectedPropertyList.forEach((item) => {
      nextSelections[item.key] = item.primary;
    });

    propertySelections = nextSelections;
  });

  $effect(() => {
    if (!selectedInfo) {
      lastSelectedSelector = null;
      elementName = '';
      styleName = '';
      return;
    }

    if (selectedInfo.selector === lastSelectedSelector) {
      return;
    }

    lastSelectedSelector = selectedInfo.selector;
    const baseName = selectedInfo.id || selectedInfo.tag || 'element';
    elementName = `${baseName}-${elementEntries.length + 1}`;
    styleName = `Style ${styleEntries.length + 1}`;
  });

  onMount(() => {
    editorValue = defaultScript;
    loadEditorFromStorage();
    setupEditor();

    const listener = (message: SelectToolMessage) => {
      if (message.type === 'select:hover') {
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

  onDestroy(() => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }

    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
  });

  const toolButtonClasses = (selected: boolean) => 'w-8 h-8 !p-0 rounded-lg text-white dark:text-white ' + (selected ? 'bg-accent-500' : 'bg-[#55503E]');
  const iconSize = 'w-5 h-5';
</script>

<main class="flex h-full w-full overflow-hidden bg-[#222121] text-white">
  <div class="relative h-full w-full min-w-full">
    <div class="flex h-full w-full flex-col">
      <section
        class="relative flex flex-col h-[36.56%] w-full bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
        aria-label="Tool panel"
      >
        <div class="flex justify-between h-14 px-3 py-2 bg-[#393a34]">
          <!-- Left side -->
          <div class="h-full flex flex-row gap-3 place-items-center">
            <Button
              class={toolButtonClasses(activeTool === 'select')}
              variant="outline"
              aria-label="Toggle selection mode"
              aria-pressed={selectionMode}
              onclick={toggleSelectionMode}
            >
              <MousePointer class={iconSize}/>
            </Button>
            <Button
              class={toolButtonClasses(activeTool === 'new-element')}
              variant="outline"
              aria-label="New element tool"
              onclick={() => setActiveTool('new-element')}
            >
              <Plus class={iconSize}/>
            </Button>
            <Button
              class="{toolButtonClasses(activeTool === 'styles')} text-sm"
              variant="outline"
              aria-label="Styles tool"
              onclick={() => setActiveTool('styles')}
            >
              $0
            </Button>
            <span>{activeToolLabel}</span>
          </div>
          <!-- Right side -->
          <div class="h-full flex flex-row gap-4 place-items-center">
            <Button
              class="dark:!text-gray-100"
              variant="outline"
              aria-label="Help"
              disabled
            >
              <CircleQuestionMark class={iconSize}/>
            </Button>
            <Button
              class={toolButtonClasses(activeTool === 'share')}
              variant="secondary"
              aria-label="Share tool"
              onclick={() => setActiveTool('share')}
            >
              <Share class={iconSize}/>
            </Button>
          </div>
        </div>

        {#if activeTool === 'select'}
          <SelectTool
            lines={selectToolLines}
            hasSelection={Boolean(selectedInfo)}
            onSaveToStyles={() => setActiveTool('save-style')}
          />
        {:else if activeTool === 'new-element'}
          <NewElementTool
            lines={newElementLines}
            hasSelection={Boolean(selectedInfo)}
            onCreate={saveElementDefinition}
          />
        {:else if activeTool === 'styles'}
          <StylesTool
            entries={styleEntriesDisplay}
            canSave={Boolean(selectedInfo)}
            onSaveStyle={() => setActiveTool('save-style')}
          />
        {:else if activeTool === 'save-style'}
          <SaveStyleTool
            items={selectedPropertyList}
            selections={propertySelections}
            styleName={styleName}
            hasSelection={Boolean(selectedInfo)}
            onSave={saveStyleDefinition}
            onStyleNameChange={(value) => {
              styleName = value;
            }}
            onToggleSelection={(key, checked) => {
              propertySelections = {
                ...propertySelections,
                [key]: checked
              };
            }}
          />
        {:else if activeTool === 'share'}
          <ShareTool
            title={scriptTitle}
            website={scriptWebsite}
            description={scriptDescription}
          />
        {/if}
      </section>

      <section
        class="relative h-[63.44%] w-full bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
        aria-label="Code editor panel"
      >
        <div class="absolute left-0 top-0 h-[7.71%] w-full bg-[#393a34]">
          <div class="absolute left-[4.25%] top-[21.59%]">
            <span class="pp-editor-title">{scriptTitle}</span>
            {#if scriptWebsite}
              <span class="pp-editor-title-muted"> @ </span>
              <span class="pp-editor-title-accent">{scriptWebsite}</span>
            {/if}
          </div>
          <ExternalLink class="absolute left-[92.25%] top-[22.73%] h-[45.45%] w-[5%] text-[#a8a8a8]"/>
        </div>
        <div class="absolute left-[5.13%] top-[7.18%] h-[82.31%] w-[92%]">
          <div class="h-full w-full" bind:this={editorHost}></div>
        </div>
      </section>
    </div>

    {#if errorMessage}
      <div class="absolute bottom-0 left-0 w-full bg-[#3b1d1d] px-[4%] py-[2%] text-caption text-[#f5b1b1]">
        {errorMessage}
      </div>
    {/if}
  </div>
</main>
