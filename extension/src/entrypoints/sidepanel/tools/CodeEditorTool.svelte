<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "wxt/browser";
  import { Play } from "lucide-svelte";
  import { Tooltip } from "bits-ui";

  import { createMonacoEditor, updateMonacoEditorValue, type MonacoCodeEditorHandle } from "@/lib/code-editor";
  import Button from "@/lib/components/Button.svelte";
  import { parseScriptMetadata } from "@/lib/utils/script-metadata";
  import { isRestrictedUrl } from "@/lib/utils/website-glob";
  import { requestScriptRun } from "./script/actions";
  import { saveState } from "./code-editor/save";
  import {
    codeEditorContent,
    elementEntries,
    scriptMetadata,
    setEditorApi,
    selectorEntries,
  } from "./code-editor/state";
  import { getTabUrl, resolveActiveTab, shouldHandleTabUpdate, type ActiveTab } from "./code-editor/tabs";
  import type { ScriptMetadataState } from "./code-editor/state";
  import { activeToolState, allowedScriptGrantsState, removeStoredToolState } from "./state-storage";
  import {
    buildDefaultScript,
    buildProtectedDisplay,
    ensureDefineBlock,
    ensureWebsiteMetadata,
    ensureScriptImports,
    resolveStoredToolStateForUrl,
    type ScriptFormatConfig,
  } from "./state-loading";
  import { errorMessage, setErrorMessage, setSuccessMessage } from "./tool-errors";

  const defineBlockStart = "// ==Selectors==";
  const defineBlockEnd = "// ==/Selectors==";
  const ppImportLines = [
    'import * as pq from "@page-proxy/pp/pp-query";',
    'import * as ps from "@page-proxy/pp/pp-style";',
    'import * as pv from "@page-proxy/pp/pp-event";',
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
    author: "",
    credits: "",
  });

  let unsubscribeScriptMetadata = () => {};

  const updateScriptMetadata = (content: string) => {
    try {
      const metadata = parseScriptMetadata(content);
      scriptMetadata.set({
        title: metadata.title || "Page Proxy",
        website: metadata.website,
        description: metadata.description,
        author: metadata.author,
        credits: metadata.credits,
      });
    } catch {
      scriptMetadata.set({
        title: "Page Proxy",
        website: "",
        description: "",
        author: "",
        credits: "",
      });
    }
  };

  const saveToolState = (content: string) => {
    try {
      void saveState({
        content,
        selectorEntries: get(selectorEntries),
        allowedGrants: get(allowedScriptGrantsState),
        isProtectedPage,
        scriptFormatConfig,
        activeTabUrl,
        activeWebsiteGlob,
        activeTool: get(activeToolState),
        getDefinitionBlock,
        setActiveWebsiteGlob: (websiteGlob) => {
          activeWebsiteGlob = websiteGlob;
        },
      });
      hasUnsavedChanges = false;
      setErrorMessage(null);
    } catch (e: unknown) {
      setErrorMessage(`Saving failed: ${e instanceof Error ? e.message : e}`);
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

  let lastRunError = $state<string | null>(null);

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

  const formatIndentation = (content: string) => content;

  const updateRunError = (errors: string[]) => {
    if (errors.length === 0) {
      if (lastRunError && get(errorMessage) === lastRunError) {
        setErrorMessage(null);
      }
      lastRunError = null;
      setSuccessMessage("Script execution succeeded");
      return;
    }

    const message = errors[0];
    lastRunError = message;
    setSuccessMessage(null);
    setErrorMessage(message);
  };

  const runScript = () => {
    if (isRunning) {
      return;
    }

    setSuccessMessage(null);

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
        selectorEntries.set(result.selectors);
        saveNow(editorValue);
        updateRunError(result.errors);
      })
      .finally(() => {
        isRunning = false;
      });
  };

  const updateEditorContent = (content: string, options: { persist?: boolean } = {}) => {
    const { persist = true } = options;
    editorValue = content;
    codeEditorContent.set(content);
    updateScriptMetadata(content);

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

  const resetScriptToDefault = async () => {
    if (isProtectedPage) {
      throw new Error("This page is protected and cannot store scripts.");
    }

    const websiteGlob = activeWebsiteGlob?.trim() ?? scriptMetadataValue.website.trim();

    if (websiteGlob) {
      await removeStoredToolState(websiteGlob).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown storage error.";
        throw new Error(`Unable to delete script from extension storage: ${message}`);
      });
    }

    const defaultContent = buildDefaultScript(websiteGlob, scriptFormatConfig);
    const normalizedContent = ensureWebsiteMetadata(
      ensureScriptImports(ensureDefineBlock(defaultContent, scriptFormatConfig), scriptFormatConfig),
      websiteGlob,
    );

    activeWebsiteGlob = websiteGlob || null;
    updateEditorContent(normalizedContent, { persist: false });
    setErrorMessage(null);
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
      selectorEntries.set([]);
      allowedScriptGrantsState.set([]);
      const baseContent = buildDefaultScript("", scriptFormatConfig);
      const displayContent = isProtectedPage ? buildProtectedDisplay(baseContent, scriptFormatConfig) : baseContent;
      updateEditorContent(displayContent, { persist: false });
      return Promise.resolve();
    }

    const resolvedState = await resolveStoredToolStateForUrl(normalizedUrl, scriptFormatConfig);
    activeWebsiteGlob = resolvedState.websiteGlob;
    activeToolState.set(resolvedState.state.activeTool);
    selectorEntries.set(resolvedState.state.selectorPanel.entries);
    allowedScriptGrantsState.set(resolvedState.state.permissions.allowedGrants);
    const normalizedBaseContent = ensureScriptImports(
      ensureDefineBlock(resolvedState.state.codeEditor.content, scriptFormatConfig),
      scriptFormatConfig,
    );
    const contentWithWebsite = ensureWebsiteMetadata(normalizedBaseContent, resolvedState.websiteGlob);
    const displayContent = isProtectedPage
      ? buildProtectedDisplay(contentWithWebsite, scriptFormatConfig)
      : contentWithWebsite;
    updateEditorContent(displayContent, { persist: false });
  };

  const applyActiveTab = (tab: ActiveTab | null) => {
    canPersistEditorChanges = false;
    const nextTabId = tab?.id ?? null;
    const nextTabUrl = getTabUrl(tab);

    activeTabId = nextTabId;
    activeTabUrl = nextTabUrl;
    isProtectedPage = isRestrictedUrl(activeTabUrl ?? undefined);

    if (isProtectedPage) {
      elementEntries.set([]);
      selectorEntries.set([]);
      allowedScriptGrantsState.set([]);

      activeWebsiteGlob = null;
      activeToolState.set("none");
      const protectedContent = buildProtectedDisplay(buildDefaultScript("", scriptFormatConfig), scriptFormatConfig);
      updateEditorContent(protectedContent, { persist: false });
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
    elementEntries.set([]);
    selectorEntries.set([]);
    allowedScriptGrantsState.set([]);
    setupEditor();
    setEditorApi({ insertDefinitions: insertDefinitionLines, resetToDefault: resetScriptToDefault });
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
    <div class="text-body flex gap-1">
      <span>{scriptMetadataValue.title}</span>
      {#if scriptMetadataValue.website}
        <span class="text-gray-600"> @ </span>
        <span class="text-accent-500">{scriptMetadataValue.website}</span>
      {/if}
      {#if hasUnsavedChanges}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <div {...props} class="flex items-center gap-2 text-xs text-blue-300">
                <span class="h-2 w-2 rounded-full bg-blue-400"></span>
              </div>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              sideOffset={6}
              class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
            >
              Unsaved changes
              <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="px-3! py-1! text-xs"
              variant="secondary"
              aria-label="Run script"
              onclick={runScript}
              disabled={isRunning}
            >
              <Play class="h-4 w-4" />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            class="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-caption text-gray-900 shadow-lg dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
          >
            Run script
            <Tooltip.Arrow class="fill-gray-50 dark:fill-[#1b1b1b]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  </div>
  <div class="h-full min-h-0 w-full overflow-auto" bind:this={editorHost}></div>
</section>
