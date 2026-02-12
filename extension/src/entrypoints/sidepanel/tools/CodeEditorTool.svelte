<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "wxt/browser";
  import { Play } from "lucide-svelte";

  import { createMonacoEditor, updateMonacoEditorValue, type MonacoCodeEditorHandle } from "@/lib/code-editor";
  import Button from "@/lib/components/Button.svelte";
  import { parseScriptMetadata } from "@/lib/utils/script-metadata";
  import { isRestrictedUrl } from "@/lib/utils/website-glob";
  import { requestSandboxEvaluation, requestScriptRun } from "./sandbox/actions";
  import { saveState } from "./code-editor/save";
  import { codeEditorContent, elementEntries, scriptMetadata, setEditorApi, selectorEntries } from "./code-editor/state";
  import { getTabUrl, resolveActiveTab, shouldHandleTabUpdate, type ActiveTab } from "./code-editor/tabs";
  import type { ScriptMetadataState } from "./code-editor/state";
  import { activeToolState } from "./state-storage";
  import {
    buildDefaultScript,
    buildProtectedDisplay,
    ensureDefineBlock,
    ensureWebsiteMetadata,
    ensureScriptImports,
    resolveStoredToolStateForUrl,
    type ScriptFormatConfig,
  } from "./state-loading";
  import { errorMessage, setErrorMessage } from "./tool-errors";

  const defineBlockStart = "// Define elements/selectors";
  const defineBlockEnd = "// End define elements/selectors";
  const ppImportLines = [
    'import * as pq from "@/lib/pp/pp-query";',
    'import * as ps from "@/lib/pp/pp-style";',
    'import * as pv from "@/lib/pp/pp-event";',
  ];
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
  let isProgrammaticUpdate = false;
  let canPersistEditorChanges = false;
  let hasUnsavedChanges = $state(false);
  let editorDomNode: HTMLElement | null = null;
  let scriptMetadataValue = $state<ScriptMetadataState>({
    title: "Page Proxy",
    website: "",
    description: "",
  });

  let unsubscribeScriptMetadata = () => {};

  const updateScriptMetadata = (content: string) => {
    try {
      const metadata = parseScriptMetadata(content);
      scriptMetadata.set({
        title: metadata.title || "Page Proxy",
        website: metadata.website,
        description: metadata.description,
      });
    } catch {
      scriptMetadata.set({
        title: "Page Proxy",
        website: "",
        description: "",
      });
    }
  };

  const saveToolState = (content: string) => {
    try {
      void saveState({
        content,
        isProtectedPage,
        scriptFormatConfig,
        activeTabUrl,
        activeWebsiteGlob,
        activeTool: get(activeToolState),
        getDefinitionBlock,
        setActiveWebsiteGlob: (websiteGlob) => {
          activeWebsiteGlob = websiteGlob;
        },
        setErrorMessage,
      });
      hasUnsavedChanges = false;
    } catch (e: unknown) {
      throw new Error(`Saving failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const autoSave = () => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (pendingAutosaveContent === null) {
      return;
    }

    const content = pendingAutosaveContent;
    pendingAutosaveContent = null;
    saveToolState(content);
  };

  const saveNow = (content: string) => {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    pendingAutosaveContent = null;
    saveToolState(content);
  };

  let lastSandboxError = $state<string | null>(null);
  let lastRunError = $state<string | null>(null);
  let sandboxRequestId = $state(0);

  const getDefinitionBlock = (content: string) => {
    const lines = content.split("\n");
    const startIndex = lines.findIndex((line) => line.trim() === defineBlockStart);
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (startIndex === -1 || endIndex === -1) {
      throw new Error(`Missing "${defineBlockStart}" block.`);
    }

    if (endIndex <= startIndex) {
      throw new Error(`Invalid "${defineBlockStart}" block ordering.`);
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

  const formatIndentation = (content: string) => content;

  const syncDefinitionsNow = (content: string) => {
    if (isProtectedPage) {
      updateSandboxError([]);
      elementEntries.set([]);
      selectorEntries.set([]);
      return;
    }
    let definitionBlock = "";
    try {
      definitionBlock = getDefinitionBlock(content);
    } catch (error) {
      updateSandboxError([error instanceof Error ? error.message : "Invalid selector definition block."]);
      elementEntries.set([]);
      selectorEntries.set([]);
      return;
    }

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

    try {
      parseScriptMetadata(editorValue);
      getDefinitionBlock(editorValue);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invalid script metadata or selector block.");
      return;
    }

    isRunning = true;
    saveNow(editorValue);
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
    codeEditorContent.set(content);
    updateScriptMetadata(content);
    if (sync) {
      syncDefinitions(content);
    }

    if (editorHandle) {
      isProgrammaticUpdate = true;
      updateMonacoEditorValue(editorHandle, content);
      isProgrammaticUpdate = false;
    }

    if (!persist) {
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      pendingAutosaveContent = null;
      hasUnsavedChanges = false;
      return;
    }

    saveToStorage(content);
  };

  const saveToStorage = (content: string) => {
    hasUnsavedChanges = true;
    pendingAutosaveContent = content;

    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }

    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      autoSave();
    }, 3000);
  };

  const saveCurrentScript = () => {
    if (!canPersistEditorChanges || isProtectedPage) {
      return;
    }
    saveNow(editorValue);
  };

  const handleEditorKeydown = (event: KeyboardEvent) => {
    if (event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) {
      return;
    }

    if (event.key.toLowerCase() !== "s") {
      return;
    }

    event.preventDefault();
    saveCurrentScript();
  };

  const getScriptLabel = () => {
    if (!scriptMetadataValue.website) {
      return scriptMetadataValue.title;
    }
    return `${scriptMetadataValue.title} @ ${scriptMetadataValue.website}`;
  };

  const insertDefinitionLines = (linesToInsert: string[]) => {
    let content = "";
    try {
      content = ensureDefineBlock(editorValue, scriptFormatConfig);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Invalid selector definition block.");
      return;
    }

    const lines = content.split("\n");
    const endIndex = lines.findIndex((line) => line.trim() === defineBlockEnd);

    if (endIndex === -1) {
      updateEditorContent(content);
      return;
    }

    lines.splice(endIndex, 0, ...linesToInsert, "");
    updateEditorContent(lines.join("\n"));
  };

  const loadStateForUrl = async (url: string | null) => {
    const normalizedUrl = url?.trim() ?? "";
    if (!normalizedUrl) {
      activeWebsiteGlob = null;
      activeToolState.set("none");
      const baseContent = buildDefaultScript("", scriptFormatConfig);
      const displayContent = isProtectedPage ? buildProtectedDisplay(baseContent, scriptFormatConfig) : baseContent;
      updateEditorContent(displayContent, { persist: false, sync: !isProtectedPage });
      return Promise.resolve();
    }

    const resolvedState = await resolveStoredToolStateForUrl(normalizedUrl, scriptFormatConfig);
    activeWebsiteGlob = resolvedState.websiteGlob;
    activeToolState.set(resolvedState.state.activeTool);
    const normalizedBaseContent = ensureScriptImports(
      ensureDefineBlock(resolvedState.state.codeEditor.content, scriptFormatConfig),
      scriptFormatConfig,
    );
    const contentWithWebsite = ensureWebsiteMetadata(normalizedBaseContent, resolvedState.websiteGlob);
    const displayContent = isProtectedPage
      ? buildProtectedDisplay(contentWithWebsite, scriptFormatConfig)
      : contentWithWebsite;
    updateEditorContent(displayContent, { persist: false, sync: !isProtectedPage });
  };

  const applyActiveTab = (tab: ActiveTab | null) => {
    canPersistEditorChanges = false;
    const nextTabId = tab?.id ?? null;
    const nextTabUrl = getTabUrl(tab);

    activeTabId = nextTabId;
    activeTabUrl = nextTabUrl;
    isProtectedPage = isRestrictedUrl(activeTabUrl ?? undefined);

    if (isProtectedPage) {
      updateSandboxError([]);
      elementEntries.set([]);
      selectorEntries.set([]);

      activeWebsiteGlob = null;
      activeToolState.set("none");
      const protectedContent = buildProtectedDisplay(buildDefaultScript("", scriptFormatConfig), scriptFormatConfig);
      updateEditorContent(protectedContent, { persist: false, sync: false });
      canPersistEditorChanges = true;
      return;
    }

    if (!activeTabUrl) {
      setErrorMessage("No active tab found.");
      void loadStateForUrl(null).finally(() => {
        canPersistEditorChanges = true;
      });
      return;
    }

    void loadStateForUrl(activeTabUrl)
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load saved script state.");
      })
      .finally(() => {
        canPersistEditorChanges = true;
      });
  };

  const refreshActiveTab = () => {
    void resolveActiveTab()
      .then((tab) => {
        applyActiveTab(tab);
      })
      .catch(() => {
        setErrorMessage("Unable to read the active tab.");
        void loadStateForUrl(null).finally(() => {
          canPersistEditorChanges = true;
        });
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

  const handleTabUpdated = (tabId: number, changeInfo: { url?: string; status?: string }, tab: ActiveTab) => {
    if (!shouldHandleTabUpdate(activeTabId, tabId, changeInfo)) {
      return;
    }
    applyActiveTab(tab ?? null);
  };

  const setupEditor = () => {
    if (!editorHost || editorHandle) {
      return;
    }

    editorHandle = createMonacoEditor(editorHost, editorValue, {
      modelUri: "file:///page-proxy/sidepanel-script.js",
      onChange: (nextValue) => {
        editorValue = nextValue;
        codeEditorContent.set(editorValue);
        updateScriptMetadata(editorValue);
        if (!isProgrammaticUpdate) {
          syncDefinitions(editorValue);
          if (canPersistEditorChanges) {
            saveToStorage(editorValue);
          }
        }
      },
    });

    editorDomNode = editorHandle.editor.getDomNode();
    if (editorDomNode) {
      editorDomNode.addEventListener("keydown", handleEditorKeydown);
    }
  };

  onMount(() => {
    unsubscribeScriptMetadata = scriptMetadata.subscribe((value) => {
      scriptMetadataValue = value;
    });

    canPersistEditorChanges = false;
    editorValue = buildDefaultScript("", scriptFormatConfig);
    codeEditorContent.set(editorValue);
    setupEditor();
    setEditorApi({ insertDefinitions: insertDefinitionLines });
    refreshActiveTab();
    browser.tabs.onActivated.addListener(handleTabActivated);
    browser.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      setEditorApi(null);
      browser.tabs.onActivated.removeListener(handleTabActivated);
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }

      if (sandboxSyncTimer) {
        window.clearTimeout(sandboxSyncTimer);
        sandboxSyncTimer = null;
      }

      if (editorHandle) {
        editorHandle.dispose();
        editorHandle = null;
      }

      if (editorDomNode) {
        editorDomNode.removeEventListener("keydown", handleEditorKeydown);
        editorDomNode = null;
      }

      unsubscribeScriptMetadata();
    };
  });
</script>

<section
  class="relative flex min-h-0 w-full flex-1 flex-col bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
  aria-label="Code editor panel"
>
  <div class="h-10 w-full bg-[#393a34] flex items-center justify-between px-4">
    <div class="text-body">
      <span>{scriptMetadataValue.title}</span>
      {#if scriptMetadataValue.website}
        <span class="text-gray-600"> @ </span>
        <span class="text-accent-500">{scriptMetadataValue.website}</span>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      {#if hasUnsavedChanges}
        <div class="flex items-center gap-2 text-xs text-blue-300" title="Unsaved changes">
          <span class="h-2 w-2 rounded-full bg-blue-400"></span>
          <span class="max-w-[18em] truncate">{getScriptLabel()}</span>
        </div>
      {/if}
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
  <div class="h-full min-h-0 w-full overflow-auto" bind:this={editorHost}></div>
</section>
