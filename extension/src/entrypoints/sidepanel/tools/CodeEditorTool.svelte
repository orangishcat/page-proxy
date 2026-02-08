<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "wxt/browser";
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { indentWithTab } from "@codemirror/commands";
  import { javascript } from "@codemirror/lang-javascript";
  import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
  import { indentRange, indentUnit } from "@codemirror/language";
  import { ExternalLink, Play } from "lucide-svelte";

  import { buildCodeEditorExtensions } from "@/lib/code-editor";
  import { pageModificationFunctions } from "@/lib/page-modification";
  import { pqSelectorReference } from "@/lib/pp/function-references";
  import Button from "@/lib/components/Button.svelte";
  import { parseScriptMetadata } from "@/lib/utils/script-metadata";
  import { isRestrictedUrl } from "@/lib/utils/url-utils";
  import { buildWebsiteGlobForUrl } from "@/lib/utils/website-glob";
  import { requestSandboxEvaluation, requestScriptRun } from "./sandbox/actions";
  import { elementEntries, scriptMetadata, setEditorApi, selectorEntries } from "./code-editor/state";
  import type { ScriptMetadataState } from "./code-editor/state";
  import {
    activeToolState,
    findStoredToolStateForUrl,
    removeStoredToolState,
    saveStoredToolState,
    type StoredToolState,
  } from "./state-storage";
  import { errorMessage, setErrorMessage } from "./tool-errors";

  const defineBlockStart = "// Define elements/selectors";
  const defineBlockEnd = "// End define elements/selectors";
  const ppImportLines = [
    'import * as pq from "@/lib/pp/pp-query";',
    'import * as ps from "@/lib/pp/pp-style";',
    'import * as pa from "@/lib/pp/pp-api";',
  ];
  const protectedComment =
    "// This page is protected. Either switch to a different page or allow the extension access to this page to run scripts.";

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let editorValue = $state("");
  let saveTimer: number | null = null;
  let pendingAutosaveContent: string | null = null;
  let sandboxSyncTimer: number | null = null;
  let pendingSandboxContent: string | null = null;
  let isRunning = $state(false);
  let activeTabId = $state<number | null>(null);
  let activeTabUrl = $state<string | null>(null);
  let activeWebsiteGlob = $state<string | null>(null);
  let isProtectedPage = $state(false);
  let isLoadingStoredState = false;
  let isProgrammaticUpdate = false;
  let scriptMetadataValue = $state<ScriptMetadataState>({
    title: "Page Proxy",
    website: "",
    description: "",
  });

  const unsubscribeScriptMetadata = scriptMetadata.subscribe((value) => {
    scriptMetadataValue = value;
  });
  let unsubscribeActiveToolState = () => {};

  const buildDefaultScript = (website: string) => {
    const normalizedWebsite = website.trim();
    return [
      ...ppImportLines,
      "",
      "// ==Page Proxy==",
      "// @title Page Proxy",
      normalizedWebsite ? `// @website ${normalizedWebsite}` : "// @website",
      "// @description",
      "// ==/Page Proxy==",
      "",
      defineBlockStart,
      defineBlockEnd,
      "",
    ].join("\n");
  };

  const ensurePpImports = (content: string) => {
    const withoutLegacyAlias = content
      .split("\n")
      .filter((line) => line.trim() !== "const pp = pa.pp;")
      .join("\n");

    const hasAllImports = ppImportLines.every((line) => withoutLegacyAlias.includes(line));
    if (hasAllImports) {
      return withoutLegacyAlias;
    }

    return [...ppImportLines, "", withoutLegacyAlias.trimStart()].join("\n");
  };

  const baseSuggestions = ["pa.element", pqSelectorReference, ...pageModificationFunctions];

  const updateScriptMetadata = (content: string) => {
    const metadata = parseScriptMetadata(content);
    if (!metadata) {
      scriptMetadata.set({
        title: "Page Proxy",
        website: "",
        description: "",
      });
      return;
    }
    scriptMetadata.set({
      title: metadata.title || "Page Proxy",
      website: metadata.website,
      description: metadata.description,
    });
  };

  const buildSuggestions = () =>
    Array.from(new Set(baseSuggestions)).map((label) => ({
      label,
      type: /^(pa|pq|ps)\./.test(label) ? "function" : "property",
    }));

  const suggestionSource: CompletionSource = (context) => {
    const word = context.matchBefore(/[\w$.]+/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }
    const options = buildSuggestions().filter((suggestion) => suggestion.label.startsWith(word.text));
    return { from: word.from, options };
  };

  const buildProtectedDisplay = (content: string) => {
    const baseContent = content.trim() ? content : buildDefaultScript("");
    const lines = baseContent.split("\n");
    if (lines[0]?.trim() === protectedComment) {
      return baseContent;
    }
    return [protectedComment, "", baseContent].join("\n");
  };

  const stripProtectedDisplay = (content: string) => {
    const lines = content.split("\n");
    if (!lines[0] || lines[0].trim() !== protectedComment) {
      return content;
    }
    lines.shift();
    if (lines[0] === "") {
      lines.shift();
    }
    return lines.join("\n");
  };

  const ensureDefineBlock = (content: string) => {
    const lines = content.split("\n");
    const startIndex = lines.findIndex((line) => line.trim() === defineBlockStart);
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return content;
    }

    return [content.trimEnd(), "", defineBlockStart, defineBlockEnd, ""].join("\n");
  };

  const normalizeContentForStorage = (content: string) => {
    const raw = isProtectedPage ? stripProtectedDisplay(content) : content;
    return ensurePpImports(ensureDefineBlock(raw));
  };

  const buildDefaultToolState = (websiteGlob: string): StoredToolState => ({
    activeTool: "none",
    codeEditor: {
      content: normalizeContentForStorage(buildDefaultScript(websiteGlob)),
    },
    websiteGlob,
    updatedAt: Date.now(),
  });

  const resolveWebsiteGlob = (content: string) => {
    const metadata = parseScriptMetadata(content);
    const fromMetadata = metadata?.website.trim() ?? "";
    if (fromMetadata) {
      return fromMetadata;
    }

    if (activeTabUrl) {
      return buildWebsiteGlobForUrl(activeTabUrl);
    }

    return activeWebsiteGlob ?? "";
  };

  const isDefaultToolState = (state: StoredToolState) => {
    const defaultState = buildDefaultToolState(state.websiteGlob);
    return state.activeTool === defaultState.activeTool && state.codeEditor.content === defaultState.codeEditor.content;
  };

  const persistToolState = (content: string) => {
    if (isProtectedPage) {
      return;
    }

    const normalizedContent = normalizeContentForStorage(content);
    const websiteGlob = resolveWebsiteGlob(normalizedContent);
    if (!websiteGlob) {
      return;
    }

    if (activeWebsiteGlob && activeWebsiteGlob !== websiteGlob) {
      removeStoredToolState(activeWebsiteGlob);
    }

    const state: StoredToolState = {
      activeTool: get(activeToolState),
      codeEditor: {
        content: normalizedContent,
      },
      websiteGlob,
      updatedAt: Date.now(),
    };

    activeWebsiteGlob = websiteGlob;

    if (isDefaultToolState(state)) {
      removeStoredToolState(websiteGlob);
      return;
    }

    saveStoredToolState(state);
  };

  const flushPendingAutosave = () => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (pendingAutosaveContent === null) {
      return;
    }

    const content = pendingAutosaveContent;
    pendingAutosaveContent = null;
    persistToolState(content);
  };

  const persistCurrentTabStateNow = () => {
    flushPendingAutosave();
  };

  let lastSandboxError = $state<string | null>(null);
  let lastRunError = $state<string | null>(null);
  let sandboxRequestId = $state(0);

  const getDefinitionBlock = (content: string) => {
    const lines = content.split("\n");
    const startIndex = lines.findIndex((line) => line.trim() === defineBlockStart);
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return "";
    }

    return lines.slice(startIndex + 1, endIndex).join("\n");
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
      extensions: [javascript({ typescript: false }), indentUnit.of("  ")],
    });
    const changes = indentRange(state, 0, state.doc.length);
    return changes.empty ? content : changes.apply(state.doc).toString();
  };

  const syncDefinitionsNow = (content: string) => {
    if (isProtectedPage) {
      updateSandboxError([]);
      elementEntries.set([]);
      selectorEntries.set([]);
      return;
    }
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
    if (isProtectedPage) {
      return;
    }

    pendingSandboxContent = content;

    if (sandboxSyncTimer) {
      window.clearTimeout(sandboxSyncTimer);
    }

    sandboxSyncTimer = window.setTimeout(() => {
      const latestContent = pendingSandboxContent ?? "";
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
      setErrorMessage("Script is empty.");
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

  const updateEditorContent = (content: string, options: { persist?: boolean; sync?: boolean } = {}) => {
    const { persist = true, sync = true } = options;
    editorValue = content;
    updateScriptMetadata(content);
    if (sync) {
      syncDefinitions(content);
    }

    if (editorView) {
      isProgrammaticUpdate = true;
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content },
      });
      isProgrammaticUpdate = false;
    }

    if (persist) {
      queueStorageSave(content);
    }
  };

  const queueStorageSave = (content: string) => {
    pendingAutosaveContent = content;

    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }

    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      flushPendingAutosave();
    }, 300);
  };

  const insertDefinitionLines = (linesToInsert: string[]) => {
    const content = ensureDefineBlock(editorValue);
    const lines = content.split("\n");
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (endIndex === -1) {
      updateEditorContent(content);
      return;
    }

    lines.splice(endIndex, 0, ...linesToInsert, "");
    updateEditorContent(lines.join("\n"));
  };

  const loadStateForUrl = (url: string | null) => {
    const normalizedUrl = url?.trim() ?? "";
    if (!normalizedUrl) {
      activeWebsiteGlob = null;
      isLoadingStoredState = true;
      activeToolState.set("none");
      const baseContent = buildDefaultScript("");
      const displayContent = isProtectedPage ? buildProtectedDisplay(baseContent) : baseContent;
      updateEditorContent(displayContent, { persist: false, sync: !isProtectedPage });
      isLoadingStoredState = false;
      return;
    }

    const matched = findStoredToolStateForUrl(normalizedUrl);
    const fallbackWebsiteGlob = buildWebsiteGlobForUrl(normalizedUrl);
    const state = matched?.state ?? buildDefaultToolState(fallbackWebsiteGlob);
    activeWebsiteGlob = matched?.websiteGlob ?? fallbackWebsiteGlob;

    isLoadingStoredState = true;
    activeToolState.set(state.activeTool);
    const baseContent = ensurePpImports(ensureDefineBlock(state.codeEditor.content));
    const displayContent = isProtectedPage ? buildProtectedDisplay(baseContent) : baseContent;
    updateEditorContent(displayContent, { persist: false, sync: !isProtectedPage });
    isLoadingStoredState = false;
  };

  const applyActiveTab = (tab: { id?: number; url?: string } | null) => {
    const nextTabId = tab?.id ?? null;
    const nextTabUrl = tab?.url ?? null;
    const shouldPersistCurrent =
      activeTabId !== null && (activeTabId !== nextTabId || (activeTabUrl ?? null) !== (nextTabUrl ?? null));

    if (shouldPersistCurrent) {
      persistCurrentTabStateNow();
    }

    activeTabId = nextTabId;
    activeTabUrl = nextTabUrl;
    isProtectedPage = isRestrictedUrl(activeTabUrl ?? undefined);

    if (isProtectedPage) {
      updateSandboxError([]);
      elementEntries.set([]);
      selectorEntries.set([]);

      activeWebsiteGlob = null;
      isLoadingStoredState = true;
      activeToolState.set("none");
      const protectedContent = buildProtectedDisplay(buildDefaultScript(""));
      updateEditorContent(protectedContent, { persist: false, sync: false });
      isLoadingStoredState = false;
      return;
    }

    if (!activeTabUrl) {
      setErrorMessage("No active tab found.");
      loadStateForUrl(null);
      return;
    }

    loadStateForUrl(activeTabUrl);
  };

  const refreshActiveTab = () => {
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        applyActiveTab(tabs[0] ?? null);
      })
      .catch(() => {
        setErrorMessage("Unable to read the active tab.");
        loadStateForUrl(null);
      });
  };

  const handleTabActivated = (activeInfo: { tabId: number }) => {
    void browser.tabs
      .get(activeInfo.tabId)
      .then((tab) => {
        applyActiveTab(tab ?? null);
      })
      .catch(() => {
        setErrorMessage("Unable to read the active tab.");
      });
  };

  const handleTabUpdated = (tabId: number, changeInfo: { url?: string }, tab: { id?: number; url?: string }) => {
    if (activeTabId !== tabId) {
      return;
    }
    if (!changeInfo.url) {
      return;
    }
    applyActiveTab(tab ?? null);
  };

  const handlePageHide = () => {
    persistCurrentTabStateNow();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "hidden") {
      return;
    }
    persistCurrentTabStateNow();
  };

  const setupEditor = () => {
    if (!editorHost || editorView) {
      return;
    }
    const state = EditorState.create({
      doc: editorValue,
      extensions: [
        ...buildCodeEditorExtensions(),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            editorValue = update.state.doc.toString();
            updateScriptMetadata(editorValue);
            if (!isProgrammaticUpdate) {
              syncDefinitions(editorValue);
              queueStorageSave(editorValue);
            }
          }
        }),
        autocompletion({ override: [suggestionSource] }),
      ],
    });
    editorView = new EditorView({
      state,
      parent: editorHost,
    });
  };

  onMount(() => {
    editorValue = buildDefaultScript("");
    setupEditor();
    setEditorApi({ insertDefinitions: insertDefinitionLines });
    unsubscribeActiveToolState = activeToolState.subscribe(() => {
      if (isLoadingStoredState) {
        return;
      }
      queueStorageSave(editorValue);
    });
    refreshActiveTab();
    browser.tabs.onActivated.addListener(handleTabActivated);
    browser.tabs.onUpdated.addListener(handleTabUpdated);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      persistCurrentTabStateNow();
      setEditorApi(null);
      browser.tabs.onActivated.removeListener(handleTabActivated);
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });

  onDestroy(() => {
    persistCurrentTabStateNow();

    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (sandboxSyncTimer) {
      window.clearTimeout(sandboxSyncTimer);
    }

    if (editorView) {
      editorView.destroy();
      editorView = null;
    }

    unsubscribeScriptMetadata();
    unsubscribeActiveToolState();
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
      <ExternalLink class="w-6 h-6 text-[#a8a8a8]" />
      <Button
        class="px-3! py-1! text-xs"
        variant="secondary"
        aria-label="Run script"
        onclick={runScript}
        disabled={isRunning}
      >
        <Play class="h-4 w-4" />
      </Button>
    </div>
  </div>
  <div class="h-full w-full overflow-auto" bind:this={editorHost}></div>
</section>
