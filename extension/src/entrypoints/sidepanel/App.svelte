<script lang="ts">
  import { onMount, type Component } from "svelte";
  import { Tooltip } from "bits-ui";
  import { browser } from "wxt/browser";
  import { get } from "svelte/store";

  import SelectTool from "./tools/SelectTool.svelte";
  import CreateTool from "./tools/CreateTool.svelte";
  import ExportTool from "./tools/ExportTool.svelte";
  import HelpTool from "./tools/HelpTool.svelte";
  import RecordTool from "./tools/RecordTool.svelte";
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
    isSidepanelDevScreenshotMessage,
    isSidepanelShortcutMessage,
    type SidepanelShortcutId,
  } from "@/lib/sidepanel-shortcuts";
  import { codeEditorContent, selectorEntries } from "./tools/code-editor/state";
  import { readToolPanelHeightSetting, saveToolPanelHeightSetting, type ToolId } from "./tools/state-storage";
  import { createToolContext, setToolContext } from "./context/tool.svelte";
  import { createEditorContext, setEditorContext } from "./context/editor.svelte";
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
  import { takeSidepanelDevScreenshots } from "./dev-screenshot";

  const toolCtx = createToolContext();
  setToolContext(toolCtx);
  const editorCtx = createEditorContext();
  setEditorContext(editorCtx);
  const toolComponents: Partial<Record<ToolId, Component>> = {
    select: SelectTool,
    create: CreateTool,
    selectors: SelectorsTool,
    record: RecordTool,
    help: HelpTool,
    share: ExportTool,
  };

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

  const setActiveTool = (tool: ToolId) => {
    if (tool === toolCtx.activeTool) {
      return;
    }

    const wasSelectTool = toolCtx.activeTool === "select";
    toolCtx.activeTool = tool;
    if (wasSelectTool && tool !== "select") {
      sendSelectionToggle(false, { clearSelection: false });
    }
  };

  const activateSelectTool = () => {
    sendSelectionToggle(true);
    if (toolCtx.activeTool === "select") {
      return;
    }

    setActiveTool("select");
  };

  const handleToolSelect = (tool: ToolId) => {
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
    getElementEntries: () => editorCtx.elementEntries,
    getEditorContent: () => get(codeEditorContent),
    insertDefinitions: (lines: string[]) => editorCtx.insertDefinitions(lines),
    replaceEditorContent: (content: string) => editorCtx.replaceEditorContent(content),
    setError: (msg: string | null) => setEditorMessage(msg, "error"),
  });

  onMount(() => {
    toolPanelHeightPx = minToolPanelHeightPx;
    void readToolPanelHeightSetting().then((storedHeight) => {
      if (storedHeight === null) {
        return;
      }

      toolPanelHeightPx = storedHeight;
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
        editorCtx.allowedGrants = message.payload.allowedGrants;
        if (message.payload.allow) {
          setToolMessage("Grant permissions saved (reload the page for permissions to take effect).", "success");
        } else {
          setToolMessage("Grant request denied.", "error");
        }
        return false;
      }

      if (import.meta.env.DEV && isSidepanelDevScreenshotMessage(message)) {
        const codeEditorPanel = document.querySelector('[aria-label="Code editor panel"]');
        void takeSidepanelDevScreenshots(new KeyboardEvent("keydown", { metaKey: true, code: "F12" }), {
          sidepanel: sidepanelRoot,
          toolPanel: toolPanelSection,
          codeEditor: codeEditorPanel,
        });
        return false;
      }

      if (!isSidepanelShortcutMessage(message)) {
        return false;
      }

      handleShortcut(message.payload.tool);
      return false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (import.meta.env.DEV && (event.metaKey || event.ctrlKey) && event.code === "F12") {
        const codeEditorPanel = document.querySelector('[aria-label="Code editor panel"]');
        void takeSidepanelDevScreenshots(event, {
          sidepanel: sidepanelRoot,
          toolPanel: toolPanelSection,
          codeEditor: codeEditorPanel,
        });
        return;
      }

      if (
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement) ||
        isCodeEditorFocused(event.target)
      ) {
        return;
      }

      if (event.key === "Escape" && toolCtx.activeTool === "select") {
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
            <Toolbar activeTool={toolCtx.activeTool} ontoolselect={handleToolSelect} />

            {#if toolCtx.activeTool === "none"}
              <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4 justify-center place-items-center">
                <p class="text-caption text-gray-500 dark:text-gray-400">Select a tool from the top bar</p>
              </div>
            {:else}
              {@const ToolComponent = toolComponents[toolCtx.activeTool]}
              {#if ToolComponent}
                <ToolComponent />
              {:else}
                <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
                  <p class="text-body">Unknown tool: {toolCtx.activeTool}</p>
                </div>
              {/if}
            {/if}

            {#if activeToolMessage}
              <StatusMessage
                message={activeToolMessage}
                onDismiss={() => setToolMessage(null, "error")}
              />
            {/if}
          </section>

          <ResizeHandle
            onheightchange={(clientY) => { toolPanelHeightPx = clientY; }}
            onresizefinish={(clientY) => {
              toolPanelHeightPx = clientY;
              void saveToolPanelHeightSetting(clientY);
            }}
          />

          <CodeEditorTool />
        </div>
      </BannerContainer>
    </div>
  </main>
</Tooltip.Provider>
