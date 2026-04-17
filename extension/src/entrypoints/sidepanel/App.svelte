<script lang="ts">
  import { onMount, type Component } from "svelte";
  import { Tooltip } from "bits-ui";
  import { browser } from "wxt/browser";
  import { get } from "svelte/store";
  import log from "@/lib/logger";

  import SelectTool from "./tools/SelectTool.svelte";
  import CreateTool from "./tools/CreateTool.svelte";
  import ExportTool from "./tools/ExportTool.svelte";
  import HelpTool from "./tools/HelpTool.svelte";
  import RecordTool from "./tools/RecordTool.svelte";
  import SettingsTool from "./tools/SettingsTool.svelte";
  import SelectorsTool from "./tools/SelectorsTool.svelte";
  import CodeEditorTool from "./tools/CodeEditorTool.svelte";
  import BannerContainer from "./banners/BannerContainer.svelte";
  import StatusMessage from "./tools/StatusMessage.svelte";
  import Toolbar from "./Toolbar.svelte";
  import ResizeHandle from "./ResizeHandle.svelte";
  import { attachSelectionListener, sendSelectionToggle } from "./tools/select-tool/actions";
  import { setEditorMessage, setToolMessage, toolMessage } from "./tools/tool-errors";
  import { isGrantResolvedMessage } from "@/lib/grant-permissions";
  import {
    appState,
    flushAppStatePersistence,
    hydrateAppState,
    replaceAppState,
    appStateActions,
    appStateSelectors,
  } from "@/lib/app-state.ts";
  import { appStateStatus } from "@/lib/app-state/storage/hydrate/hydration";
  import { isSidepanelShortcutMessage, type SidepanelShortcutId } from "@/lib/sidepanel-shortcuts";
  import { codeEditorContent, selectorEntries } from "./tools/code-editor/state";
  import type { ToolId } from "@/lib/stored-tool-state";
  import { isEditableTarget, isCodeEditorFocused } from "@/lib/utils/dom-checks";
  import { getShortcutTool } from "@/lib/utils/keyboard-shortcuts";
  import {
    isSelectorSaveMessage,
    isRecordConverterSaveMessage,
    isApplyStyleSaveMessage,
    saveSelectorDefinition,
    saveRecordConverterDefinition,
  } from "./message-handler";
  import { recordSidepanelAction } from "./tools/record/state";

  const logger = log.getLogger("sidepanel-app-state");
  const toolComponents: Partial<Record<ToolId, Component>> = {
    select: SelectTool,
    create: CreateTool,
    selectors: SelectorsTool,
    record: RecordTool,
    settings: SettingsTool,
    help: HelpTool,
    share: ExportTool,
  };
  const activeTool = $derived.by(() => appStateSelectors.getActiveTool());

  let toolPanelHeightPx = $state<number | null>(null);
  let toolPanelSection = $state<HTMLElement | null>(null);
  let sidepanelRoot = $state<HTMLElement | null>(null);
  const activeToolMessage = $derived($toolMessage);

  const minToolPanelHeightPx = 300;
  const maxToolPanelHeightPx = 600;

  const toolPanelStyle = $derived(
    toolPanelHeightPx === null
      ? undefined
      : `height: ${toolPanelHeightPx}px; min-height: ${minToolPanelHeightPx}px; max-height: ${maxToolPanelHeightPx}px;`,
  );

  const appStateHydratePromise = hydrateAppState().then((state) => {
    replaceAppState(state);
    return state;
  });

  /** App state fields that are tracked by the $effect below, and automatically persisted to extension local storage */
  const deps = $derived.by(() => ({
    showHelpButton: appState.settings.showHelpButton,
    disableAllGrants: appState.settings.disableAllGrants,
    activeTool: appState.sidepanel.activeTool,
    toolPanelHeightPx: appState.sidepanel.toolPanelHeightPx,
    helpBannerDismissed: appState.sidepanel.helpBannerDismissed,
    userscriptReloadBannerDismissed: appState.sidepanel.userscriptReloadBannerDismissed,
    activeTabId: appState.currentTab.activeTabId,
    activeScriptName: appState.currentTab.activeScriptName,
    activeWebsiteGlob: appState.currentTab.activeWebsiteGlob,
    defaultScriptName: appState.currentTab.defaultScriptName,
    availableScriptOptionsCount: appState.currentTab.availableScriptOptions.length,
    openTabsCount: Object.keys(appState.session.openTabsByTabId).length, // what you put as the value doesn't matter as long as the field you want to persist is referenced
    selectedScriptsCount: Object.keys(appState.session.selectedScriptByHostname).length, // this is just for prettier output in debug logging
    recordPanelsCount: Object.keys(appState.recordPanelsByTabId).length,
    scriptsCount: Object.keys(appState.scriptsByName).length,
  }));

  $effect(() => {
    if (!appStateStatus.isAppStateHydrated) {
      logger.debug("skip app-state flush", {
        hydrated: appStateStatus.isAppStateHydrated,
      });
      return;
    }

    deps;
    logger.debug("flush app-state persistence from sidepanel", deps);
    void flushAppStatePersistence();
  });

  $effect(() => {
    if (!appState.settings.showHelpButton && activeTool === "help") {
      appStateActions.setActiveTool("none");
    }
  });

  const setActiveTool = (tool: ToolId) => {
    if (tool === activeTool) return;
    const wasSelectTool = activeTool === "select";
    appStateActions.setActiveTool(tool);
    if (wasSelectTool && tool !== "select") {
      sendSelectionToggle(false, { clearSelection: false });
    }
  };

  const activateSelectTool = () => {
    sendSelectionToggle(true);
    if (activeTool === "select") return;
    setActiveTool("select");
  };

  const handleToolSelect = (tool: ToolId) => {
    setToolMessage(null, "error");

    if (tool === "select") {
      activateSelectTool();
      return;
    }
    setActiveTool(tool);
  };

  const handleShortcut = (tool: SidepanelShortcutId) => {
    handleToolSelect(tool as ToolId);
  };

  const buildDeps = () => ({
    getSelectorEntries: () => get(selectorEntries),
    getElementEntries: () => appState.currentTab.elementEntries,
    getEditorContent: () => get(codeEditorContent),
    insertDefinitions: (lines: string[]) => {
      const editorApi = appState.currentTab.editorApi;
      if (!editorApi) return false;
      editorApi.insertDefinitions(lines);
      return true;
    },
    replaceEditorContent: (content: string) => {
      const editorApi = appState.currentTab.editorApi;
      if (!editorApi) return false;

      editorApi.replaceEditorContent(content);
      return true;
    },
    setError: (msg: string | null) => setEditorMessage(msg, "error"),
  });

  onMount(() => {
    void appStateHydratePromise
      .then((state) => {
        toolPanelHeightPx = state.sidepanel.toolPanelHeightPx ?? minToolPanelHeightPx;
      })
      .catch((error) => {
        setToolMessage(error instanceof Error ? error.message : "Unable to load extension settings.", "error");
      });

    sendSelectionToggle(false);

    const cleanup = attachSelectionListener();

    const handleRuntimeMessage = (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (isSelectorSaveMessage(message)) {
        sendResponse(saveSelectorDefinition(message.payload, buildDeps()));
        return true;
      }

      if (isRecordConverterSaveMessage(message)) {
        void saveRecordConverterDefinition(message.payload, buildDeps()).then((result) => {
          sendResponse(result);
        });
        return true;
      }

      if (isApplyStyleSaveMessage(message)) {
        recordSidepanelAction("Applied style", JSON.stringify(message.cssValues));
        sendResponse(undefined);
        return false;
      }

      if (isGrantResolvedMessage(message)) {
        appStateActions.setActiveScriptAllowedGrants(message.payload.allowedGrants);
        if (message.payload.allow) {
          setToolMessage("Grant permissions saved (reload the page for permissions to take effect).", "success");
        } else {
          setToolMessage("Grant request denied.", "error");
        }
        return false;
      }

      if (!isSidepanelShortcutMessage(message)) {
        return false;
      }

      handleShortcut(message.payload.tool);
      return false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement) ||
        isCodeEditorFocused(event.target)
      ) {
        return;
      }

      if (event.key === "Escape" && activeTool === "select") {
        event.preventDefault();
        sendSelectionToggle(false, { clearSelection: false });
        return;
      }

      const tool = getShortcutTool(event);
      if (!tool) {
        return;
      }

      handleShortcut(tool);
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    browser.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      cleanup();
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
      sendSelectionToggle(false);
    };
  });
</script>

<Tooltip.Provider>
  <main bind:this={sidepanelRoot} class="flex h-full w-full overflow-hidden bg-[#222121] text-white">
    <div class="h-full w-full min-h-0 min-w-full">
      <BannerContainer>
        <div class="flex h-full w-full min-h-0 flex-col">
          <section
            class="relative flex w-full shrink-0 flex-col bg-[#282824]"
            aria-label="Tool panel"
            bind:this={toolPanelSection}
            style={toolPanelStyle}
          >
            <Toolbar {activeTool} showHelpButton={appState.settings.showHelpButton} ontoolselect={handleToolSelect} />

            {#if activeTool === "none"}
              <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4 justify-center place-items-center">
                <p class="text-caption text-gray-500 dark:text-gray-400">Select a tool from the top bar</p>
              </div>
            {:else}
              {@const ToolComponent = toolComponents[activeTool]}
              {#if ToolComponent}
                <ToolComponent />
              {:else}
                <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
                  <p class="text-body">Unknown tool: {activeTool}</p>
                </div>
              {/if}
            {/if}

            {#if activeToolMessage}
              <StatusMessage message={activeToolMessage} onDismiss={() => setToolMessage(null, "error")} />
            {/if}
          </section>

          <ResizeHandle
            onheightchange={(clientY) => {
              toolPanelHeightPx = clientY;
            }}
            onresizefinish={(clientY) => {
              toolPanelHeightPx = clientY;
              appStateActions.setToolPanelHeight(clientY);
            }}
          />

          <CodeEditorTool />
        </div>
      </BannerContainer>
    </div>
  </main>
</Tooltip.Provider>
