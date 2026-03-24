<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "wxt/browser";

  import {
    createMonacoEditor,
    updateMonacoEditorValue,
    type MonacoCodeEditorHandle,
  } from "@/lib/code-editor";
  import {
    applyScriptRunErrorMarker,
    clearScriptRunErrorMarker,
  } from "./code-editor/error-markers";
  import { createAutosaveManager } from "./code-editor/autosave";
  import { parseScriptMetadata } from "@/lib/utils/script-metadata";
  import { requestScriptRun } from "./script/actions";
  import { codeEditorContent } from "./code-editor/state";
  import { setRecordPanelActiveTab } from "./record/state";
  import {
    buildDefaultScript,
    ensureDefineBlock,
    type ScriptFormatConfig,
  } from "./state-loading";
  import StatusMessage from "./StatusMessage.svelte";
  import { editorMessage, setEditorMessage, setEditorMessageFromUnknown } from "./tool-errors";
  import { getToolContext } from "../context/tool.svelte";
  import { getEditorContext } from "../context/editor.svelte";
  import {
    getDefinitionBlock,
    insertDefinitionLines,
    defineBlockStart,
    defineBlockEnd,
  } from "./code-editor/definition-manager";
  import { runScript as runScriptImpl } from "./code-editor/script-runner";
  import {
    refreshActiveTab as refreshActiveTabImpl,
    handleTabActivated as handleTabActivatedImpl,
    handleTabUpdated as handleTabUpdatedImpl,
    selectScriptForCurrentTab as selectScriptForCurrentTabImpl,
    type TabLoaderState,
  } from "./code-editor/tab-loader";
  import {
    saveToolState,
    resetScriptToDefault as resetScriptToDefaultImpl,
    unsavedTabSwitchWarning,
    type EditorActionsDeps,
  } from "./code-editor/editor-actions";
  import EditorToolbar from "./code-editor/EditorToolbar.svelte";

  const toolCtx = getToolContext();
  const editorCtx = getEditorContext();
  const ppImportLines = ['import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";'];
  const protectedComment =
    "// This page is protected. Either switch to a different page or allow the extension access to this page to run scripts.";
  const scriptFormatConfig: ScriptFormatConfig = {
    ppImportLines,
    defineBlockStart,
    defineBlockEnd,
    protectedComment,
  };

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let isRunning = $state(false);
  let hasUnsavedChanges = $state(false);
  let lastRunError = $state<string | null>(null);
  let lastRunErrorStack = $state<string | null>(null);
  let editorDomNode: HTMLElement | null = null;
  let unsubscribeEditorMessageStore = () => {};

  let tabState = $state<TabLoaderState>({
    activeTabId: null,
    activeTabUrl: null,
    activeWebsiteGlob: null,
    activeScriptName: null,
    defaultScriptName: null,
    availableScriptOptions: [],
    isProtectedPage: false,
    canPersistEditorChanges: false,
    hasUnsavedChanges: false,
    isProgrammaticUpdate: false,
    editorValue: "",
  });

  const activeEditorMessage = $derived($editorMessage);
  const updateScriptMetadata = (content: string) => {
    try {
      const metadata = parseScriptMetadata(content);
      editorCtx.scriptMetadata = {
        title: metadata.title || "Page Proxy",
        website: metadata.website,
        description: metadata.description,
        author: metadata.author,
        credits: metadata.credits,
      };
    } catch {
      editorCtx.scriptMetadata = { title: "Page Proxy", website: "", description: "", author: "", credits: "" };
    }
  };

  const autosave = createAutosaveManager({
    onSave: (content) => void saveToolState(content, buildEditorActionsDeps()),
    onPendingRefreshWarning: () => setEditorMessage(unsavedTabSwitchWarning, "error"),
  });

  const updateEditorContent = (content: string, options: { persist?: boolean } = {}) => {
    const { persist = true } = options;
    tabState.editorValue = content;
    codeEditorContent.set(content);
    updateScriptMetadata(content);
    if (editorHandle) {
      tabState.isProgrammaticUpdate = true;
      updateMonacoEditorValue(editorHandle, content);
      tabState.isProgrammaticUpdate = false;
    }
    if (!persist) {
      autosave.cancel();
      hasUnsavedChanges = false;
      tabState.hasUnsavedChanges = false;
      return;
    }
    hasUnsavedChanges = true;
    tabState.hasUnsavedChanges = true;
    autosave.schedule(content);
  };

  const buildEditorActionsDeps = (): EditorActionsDeps => ({
    tabState,
    allowedGrants: editorCtx.allowedGrants,
    activeTool: toolCtx.activeTool,
    scriptMetadata: editorCtx.scriptMetadata,
    scriptFormatConfig,
    setHasUnsavedChanges: (v) => { hasUnsavedChanges = v; tabState.hasUnsavedChanges = v; },
    autosaveOnSaveSuccess: () => autosave.onSaveSuccess(),
    refreshActiveTab,
    getEditorMessage: () => get(editorMessage),
    setEditorMessage,
    updateEditorContent,
  });

  const buildTabLoaderDeps = () => ({
    state: tabState,
    setActiveToolId: (tool: string) => { toolCtx.activeTool = tool as typeof toolCtx.activeTool; },
    setAllowedGrants: (grants: unknown[]) => { editorCtx.allowedGrants = grants as typeof editorCtx.allowedGrants; },
    setElementEntries: (entries: unknown[]) => { editorCtx.elementEntries = entries as typeof editorCtx.elementEntries; },
    setRecordPanelActiveTab,
    updateEditorContent,
    setEditorMessage,
    setEditorMessageFromUnknown,
    scriptFormatConfig,
    autosave,
  });

  const buildRunScriptDeps = () => ({
    getLastRunError: () => lastRunError,
    setLastRunError: (v: string | null) => { lastRunError = v; },
    getLastRunErrorStack: () => lastRunErrorStack,
    setLastRunErrorStack: (v: string | null) => { lastRunErrorStack = v; },
    getEditorMessage: () => get(editorMessage),
    setEditorMessage,
    getEditorHandle: () => editorHandle,
    getIsRunning: () => isRunning,
    setIsRunning: (v: boolean) => { isRunning = v; },
    getActiveScriptName: () => tabState.activeScriptName,
    saveNow: (content: string) => autosave.saveNow(content),
    getDefinitionBlock,
    setEditorMessageFromUnknown,
    parseScriptMetadata,
    requestScriptRun,
  });

  const saveCurrentScript = () => {
    if (!tabState.canPersistEditorChanges || tabState.isProtectedPage) return;
    autosave.saveNow(tabState.editorValue);
  };

  const handleEditorKeydown = (event: KeyboardEvent) => {
    if (event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() !== "s") return;
    event.preventDefault();
    saveCurrentScript();
  };

  const insertDefinitionLinesInEditor = (linesToInsert: string[]) => {
    let content = "";
    try {
      content = ensureDefineBlock(tabState.editorValue, scriptFormatConfig);
    } catch (error) {
      setEditorMessageFromUnknown(error, "Invalid selector definition block.");
      return;
    }
    updateEditorContent(insertDefinitionLines(content, linesToInsert, defineBlockEnd));
  };

  const runScript = () => {
    try {
      parseScriptMetadata(tabState.editorValue);
      getDefinitionBlock(tabState.editorValue);
    } catch (error) {
      setEditorMessageFromUnknown(error, "Invalid script metadata or selector block.");
      return;
    }
    runScriptImpl(tabState.editorValue, buildRunScriptDeps());
  };

  const selectScriptForCurrentTab = (scriptName: string) => {
    void selectScriptForCurrentTabImpl(scriptName, buildTabLoaderDeps()).catch((error) => {
      setEditorMessageFromUnknown(error, "Unable to switch scripts.");
    });
  };

  const refreshActiveTab = () => refreshActiveTabImpl(buildTabLoaderDeps());
  const handleTabActivated = (activeInfo: { tabId: number }) => handleTabActivatedImpl(activeInfo, buildTabLoaderDeps());
  const handleTabUpdated = (tabId: number, changeInfo: { url?: string; status?: string }, tab: Parameters<typeof handleTabUpdatedImpl>[2]) =>
    handleTabUpdatedImpl(tabId, changeInfo, tab, buildTabLoaderDeps());

  const setupEditor = () => {
    if (!editorHost || editorHandle) return;

    editorHandle = createMonacoEditor(editorHost, tabState.editorValue, {
      modelUri: "file:///page-proxy/sidepanel-script.js",
      onChange: (nextValue) => {
        tabState.editorValue = nextValue;
        codeEditorContent.set(nextValue);
        updateScriptMetadata(nextValue);
        if (!tabState.isProgrammaticUpdate && tabState.canPersistEditorChanges) {
          hasUnsavedChanges = true;
          tabState.hasUnsavedChanges = true;
          autosave.schedule(nextValue);
        }
      },
    });

    editorDomNode = editorHandle.editor.getDomNode();
    if (editorDomNode) {
      editorDomNode.addEventListener("keydown", handleEditorKeydown);
    }
  };

  onMount(() => {
    unsubscribeEditorMessageStore = editorMessage.subscribe((value) => {
      if (value?.status === "error" && value.text === lastRunError && lastRunError) {
        applyScriptRunErrorMarker(editorHandle, lastRunError, lastRunErrorStack);
        return;
      }
      if (value?.text !== lastRunError) {
        lastRunError = null;
        lastRunErrorStack = null;
      }
      clearScriptRunErrorMarker(editorHandle);
    });

    tabState.canPersistEditorChanges = false;
    tabState.editorValue = buildDefaultScript("", scriptFormatConfig);
    codeEditorContent.set(tabState.editorValue);
    editorCtx.elementEntries = [];
    editorCtx.allowedGrants = [];
    setupEditor();
    editorCtx.api = {
      insertDefinitions: insertDefinitionLinesInEditor,
      replaceEditorContent: (content) => updateEditorContent(content),
      resetToDefault: () => resetScriptToDefaultImpl(buildEditorActionsDeps()),
    };
    refreshActiveTab();
    browser.tabs.onActivated.addListener(handleTabActivated);
    browser.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      editorCtx.api = null;
      browser.tabs.onActivated.removeListener(handleTabActivated);
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
      autosave.dispose();

      if (editorHandle) {
        editorHandle.dispose();
        editorHandle = null;
      }

      if (editorDomNode) {
        editorDomNode.removeEventListener("keydown", handleEditorKeydown);
        editorDomNode = null;
      }

      unsubscribeEditorMessageStore();
      clearScriptRunErrorMarker(editorHandle);
    };
  });
</script>

<section
  class="relative flex min-h-0 w-full flex-1 flex-col bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
  aria-label="Code editor panel"
>
  <EditorToolbar
    scriptTitle={editorCtx.scriptMetadata.title}
    scriptWebsite={tabState.activeWebsiteGlob ?? editorCtx.scriptMetadata.website}
    scriptOptions={tabState.availableScriptOptions}
    selectedScriptName={tabState.activeScriptName}
    {hasUnsavedChanges}
    {isRunning}
    onrun={runScript}
    onselectscript={selectScriptForCurrentTab}
  />
  <div class="h-full min-h-0 w-full overflow-auto" bind:this={editorHost}></div>
  {#if activeEditorMessage}
    <StatusMessage
      message={activeEditorMessage}
      onDismiss={() => setEditorMessage(null, "error")}
    />
  {/if}
</section>
