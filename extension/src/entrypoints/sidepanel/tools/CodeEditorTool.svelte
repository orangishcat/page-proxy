<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "wxt/browser";
  import { Play } from "lucide-svelte";
  import { Tooltip } from "bits-ui";

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
  import Button from "@/lib/components/Button.svelte";
  import { parseScriptMetadata } from "@/lib/utils/script-metadata";
  import { isRestrictedUrl } from "@/lib/utils/website-glob";
  import { requestScriptRun } from "./script/actions";
  import { saveState } from "./code-editor/save";
  import {
    codeEditorContent,
    selectorEntries,
  } from "./code-editor/state";
  import { getTabUrl, resolveActiveTab, shouldHandleTabUpdate, type ActiveTab } from "./code-editor/tabs";
  import { removeStoredToolState } from "./state-storage";
  import { setRecordPanelActiveTab } from "./record/state";
  import {
    buildDefaultScript,
    buildProtectedDisplay,
    ensureDefineBlock,
    ensureWebsiteMetadata,
    resolveStoredToolStateForUrl,
    type ScriptFormatConfig,
  } from "./state-loading";
  import StatusMessage from "./StatusMessage.svelte";
  import {
    editorMessage,
    setEditorMessage,
    setEditorMessageFromUnknown,
  } from "./tool-errors";
  import { getToolContext } from "../context/tool.svelte";
  import { getEditorContext } from "../context/editor.svelte";

  const toolCtx = getToolContext();
  const editorCtx = getEditorContext();

  const defineBlockStart = "// ==Selectors==";
  const defineBlockEnd = "// ==/Selectors==";
  const ppImportLines = ['import { pa, pn, pq, ps, pt, pv } from "@page-proxy/pp";'];
  const protectedComment =
    "// This page is protected. Either switch to a different page or allow the extension access to this page to run scripts.";
  const unsavedTabSwitchWarning = "Unsaved changes! Please manually save (Ctrl/Cmd+S) to continue.";
  const scriptFormatConfig: ScriptFormatConfig = {
    ppImportLines,
    defineBlockStart,
    defineBlockEnd,
    protectedComment,
  };
  const saveFailurePrefix = "Saving failed:";

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let editorValue = $state("");
  let isRunning = $state(false);
  let activeTabId = $state<number | null>(null);
  let activeTabUrl = $state<string | null>(null);
  let activeWebsiteGlob = $state<string | null>(null);
  let activeScriptName = $state<string | null>(null);
  let isProtectedPage = $state(false);
  let isProgrammaticUpdate = false;
  let canPersistEditorChanges = false;
  let hasUnsavedChanges = $state(false);
  let editorDomNode: HTMLElement | null = null;
  let unsubscribeEditorMessageStore = () => {};
  let lastRunErrorStack = $state<string | null>(null);
  const activeEditorMessage = $derived($editorMessage);

  const shouldClearErrorOnSuccessfulSave = (
    message: { text: string; status: "success" | "error"; stackTrace: string | null } | null,
  ) => {
    if (!message || message.status !== "error") {
      return false;
    }

    return message.text === unsavedTabSwitchWarning || message.text.startsWith(saveFailurePrefix);
  };

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
      editorCtx.scriptMetadata = {
        title: "Page Proxy",
        website: "",
        description: "",
        author: "",
        credits: "",
      };
    }
  };

  const saveToolState = async (content: string) => {
    try {
      await saveState({
        content,
        selectorEntries: get(selectorEntries),
        allowedGrants: editorCtx.allowedGrants,
        isProtectedPage,
        scriptFormatConfig,
        activeTabUrl,
        activeWebsiteGlob,
        activeScriptName,
        activeTool: toolCtx.activeTool,
        getDefinitionBlock,
        setActiveWebsiteGlob: (websiteGlob) => {
          activeWebsiteGlob = websiteGlob;
        },
        setActiveScriptName: (scriptName) => {
          activeScriptName = scriptName;
        },
      });
      hasUnsavedChanges = false;
      const shouldRefreshPendingTab = autosave.onSaveSuccess();
      if (shouldClearErrorOnSuccessfulSave(get(editorMessage))) {
        setEditorMessage(null, "error");
      }
      if (shouldRefreshPendingTab) {
        refreshActiveTab();
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setEditorMessage(`${saveFailurePrefix} ${e.message}`, "error", typeof e.stack === "string" ? e.stack : null);
      } else {
        setEditorMessage(`${saveFailurePrefix} ${e}`, "error");
      }
    }
  };

  const autosave = createAutosaveManager({
    onSave: (content) => void saveToolState(content),
    onPendingRefreshWarning: () => setEditorMessage(unsavedTabSwitchWarning, "error"),
  });

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

  const updateRunError = (errors: string[], errorStacks: string[] = []) => {
    if (errors.length === 0) {
      if (lastRunError && get(editorMessage)?.status === "error" && get(editorMessage)?.text === lastRunError) {
        setEditorMessage(null, "error");
      }
      lastRunError = null;
      lastRunErrorStack = null;
      clearScriptRunErrorMarker(editorHandle);
      setEditorMessage("Script execution succeeded", "success");
      return;
    }

    const message = errors.find((value) => value.trim().length > 0) ?? "Script execution failed.";
    const stackTrace = errorStacks.find((value) => value.trim().length > 0) ?? null;
    lastRunError = message;
    lastRunErrorStack = stackTrace;
    setEditorMessage(message, "error", stackTrace);
    applyScriptRunErrorMarker(editorHandle, message, stackTrace);
  };

  const handleRunFailure = (error: unknown) => {
    const message = error instanceof Error ? error.message.trim() : String(error).trim();
    const errorStack = error instanceof Error && typeof error.stack === "string" ? error.stack : null;
    updateRunError([message || "Script execution failed."], errorStack ? [errorStack] : []);
  };

  const runScript = () => {
    if (isRunning) {
      return;
    }

    if (get(editorMessage)?.status === "success") {
      setEditorMessage(null, "success");
    }

    if (!editorValue.trim()) {
      setEditorMessage("Script is empty.", "error");
      return;
    }

    try {
      parseScriptMetadata(editorValue);
      getDefinitionBlock(editorValue);
    } catch (error) {
      setEditorMessageFromUnknown(error, "Invalid script metadata or selector block.");
      return;
    }

    isRunning = true;
    autosave.saveNow(editorValue);
    const formattedScript = formatIndentation(editorValue);
    void requestScriptRun(formattedScript)
      .then((result) => {
        autosave.saveNow(editorValue);
        updateRunError(result.errors, result.errorStacks);
      })
      .catch((error: unknown) => {
        handleRunFailure(error);
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
      autosave.cancel();
      hasUnsavedChanges = false;
      return;
    }

    hasUnsavedChanges = true;
    autosave.schedule(content);
  };

  const saveCurrentScript = () => {
    if (!canPersistEditorChanges || isProtectedPage) {
      return;
    }
    autosave.saveNow(editorValue);
  };

  const resetScriptToDefault = async () => {
    if (isProtectedPage) {
      throw new Error("This page is protected and cannot store scripts.");
    }

    const activeWebsite = activeWebsiteGlob?.trim() ?? "";
    const activeScript = activeScriptName?.trim() ?? "";
    const metadataScriptName = editorCtx.scriptMetadata.title.trim();
    const metadataWebsite = editorCtx.scriptMetadata.website.trim();
    const websiteGlob = activeWebsite || metadataWebsite;
    const scriptNamesToRemove = Array.from(
      new Set([activeScript, metadataScriptName].filter((name) => name.length > 0)),
    );

    if (scriptNamesToRemove.length > 0) {
      await Promise.all(scriptNamesToRemove.map((name) => removeStoredToolState(name))).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown storage error.";
        throw new Error(`Unable to delete script from extension storage: ${message}`);
      });
    }

    const defaultContent = buildDefaultScript(websiteGlob, scriptFormatConfig);
    const normalizedContent = ensureWebsiteMetadata(ensureDefineBlock(defaultContent, scriptFormatConfig), websiteGlob);

    activeWebsiteGlob = websiteGlob || null;
    activeScriptName = null;
    updateEditorContent(normalizedContent, { persist: false });
    setEditorMessage(null, "error");
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
      setEditorMessageFromUnknown(error, "Invalid selector definition block.");
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
      activeScriptName = null;
      activeWebsiteGlob = null;
      toolCtx.activeTool = "none";
      editorCtx.allowedGrants = [];
      const baseContent = buildDefaultScript("", scriptFormatConfig);
      const displayContent = isProtectedPage ? buildProtectedDisplay(baseContent, scriptFormatConfig) : baseContent;
      updateEditorContent(displayContent, { persist: false });
      return Promise.resolve();
    }

    const resolvedState = await resolveStoredToolStateForUrl(normalizedUrl, scriptFormatConfig);
    activeScriptName = resolvedState.scriptName;
    activeWebsiteGlob = resolvedState.websiteGlob;
    toolCtx.activeTool = resolvedState.state.activeTool;
    editorCtx.allowedGrants = resolvedState.state.permissions.allowedGrants;
    const normalizedBaseContent = ensureDefineBlock(resolvedState.state.codeEditor.content, scriptFormatConfig);
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
    setRecordPanelActiveTab(nextTabId);
    isProtectedPage = isRestrictedUrl(activeTabUrl ?? undefined);

    if (isProtectedPage) {
      editorCtx.elementEntries = [];
      editorCtx.allowedGrants = [];

      activeWebsiteGlob = null;
      activeScriptName = null;
      toolCtx.activeTool = "none";
      const protectedContent = buildProtectedDisplay(buildDefaultScript("", scriptFormatConfig), scriptFormatConfig);
      updateEditorContent(protectedContent, { persist: false });
      canPersistEditorChanges = true;
      return;
    }

    if (!activeTabUrl) {
      setEditorMessage("No active tab found.", "error");
      void loadStateForUrl(null).finally(() => {
        canPersistEditorChanges = true;
      });
      return;
    }

    void loadStateForUrl(activeTabUrl)
      .catch((error) => {
        setEditorMessageFromUnknown(error, "Unable to load saved script state.");
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
        setEditorMessage("Unable to read the active tab.", "error");
        void loadStateForUrl(null).finally(() => {
          canPersistEditorChanges = true;
        });
      });
  };

  const handleTabActivated = (activeInfo: { tabId: number }) => {
    if (autosave.queuePendingTabRefresh(editorValue, hasUnsavedChanges, isProgrammaticUpdate)) {
      return;
    }

    void browser.tabs
      .get(activeInfo.tabId)
      .then((tab) => {
        applyActiveTab(tab ?? null);
      })
      .catch(() => {
        setEditorMessage("Unable to read the active tab.", "error");
      });
  };

  const handleTabUpdated = (tabId: number, changeInfo: { url?: string; status?: string }, tab: ActiveTab) => {
    if (!shouldHandleTabUpdate(activeTabId, tabId, changeInfo)) {
      return;
    }
    if (autosave.queuePendingTabRefresh(editorValue, hasUnsavedChanges, isProgrammaticUpdate)) {
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
        if (!isProgrammaticUpdate && canPersistEditorChanges) {
          hasUnsavedChanges = true;
          autosave.schedule(editorValue);
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

    canPersistEditorChanges = false;
    editorValue = buildDefaultScript("", scriptFormatConfig);
    codeEditorContent.set(editorValue);
    editorCtx.elementEntries = [];
    editorCtx.allowedGrants = [];
    setupEditor();
    editorCtx.api = {
      insertDefinitions: insertDefinitionLines,
      replaceEditorContent: (content) => updateEditorContent(content),
      resetToDefault: resetScriptToDefault,
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
  <div class="h-10 w-full bg-[#393a34] flex items-center justify-between px-4">
    <div class="text-body flex gap-1">
      <span>{editorCtx.scriptMetadata.title}</span>
      {#if editorCtx.scriptMetadata.website}
        <span class="text-gray-600"> @ </span>
        <span class="text-accent-500">{editorCtx.scriptMetadata.website}</span>
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
  {#if activeEditorMessage}
    <StatusMessage
      message={activeEditorMessage}
      onDismiss={() => setEditorMessage(null, "error")}
    />
  {/if}
</section>
