<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { browser } from "wxt/browser";
  import { CircleQuestionMark, MousePointer, Plus, Share } from "lucide-svelte";

  import { get } from "svelte/store";
  import SelectTool from "./tools/SelectTool.svelte";
  import NewElementTool from "./tools/NewElementTool.svelte";
  import ShareTool from "./tools/ShareTool.svelte";
  import HelpTool from "./tools/HelpTool.svelte";
  import SelectorsTool from "./tools/SelectorsTool.svelte";
  import CodeEditorTool from "./tools/CodeEditorTool.svelte";
  import Button from "@/lib/components/Button.svelte";
  import { attachSelectionListener, sendSelectionToggle } from "./tools/select-tool/actions";
  import { errorMessage, setErrorMessage } from "./tools/tool-errors";
  import { isSidepanelShortcutMessage, type SidepanelShortcutId } from "@/lib/sidepanel-shortcuts";
  import type { SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { pqSelectorReference } from "@/lib/pp/function-references";
  import { elementEntries, insertDefinitions, sanitizeVariableName, selectorEntries } from "./tools/code-editor/state";
  import { activeToolState, type ToolId } from "./tools/state-storage";

  type ToolbarControlId = SidepanelShortcutId;

  const toolLabels: Record<ToolId, string> = {
    select: "Select",
    "new-element": "New element",
    selectors: "Selectors",
    share: "Share",
    help: "Help",
    none: "",
  };

  let activeTool = $state<ToolId>("none");
  let hoveredTool = $state<ToolbarControlId | null>(null);
  let lastHoveredTool = $state<ToolbarControlId | null>(null);
  let isToolbarHovered = $state(false);
  let errorMessageValue = $state<string | null>(null);

  const unsubscribeErrorMessage = errorMessage.subscribe((value) => {
    errorMessageValue = value;
  });
  const unsubscribeActiveToolState = activeToolState.subscribe((tool) => {
    if (tool === activeTool) {
      return;
    }

    const wasSelectTool = activeTool === "select";
    activeTool = tool;
    const isSelectTool = tool === "select";
    if (wasSelectTool !== isSelectTool) {
      sendSelectionToggle(isSelectTool);
    }
  });

  const activeToolLabel = $derived(toolLabels[activeTool]);
  const shortcutLabels: Record<ToolbarControlId, string> = {
    select: "⇧1",
    "new-element": "⇧2",
    selectors: "⇧3",
    help: "⇧4",
    share: "⇧5",
  };
  const hoverCandidate = $derived(hoveredTool ?? lastHoveredTool);
  const hoveredShortcutLabel = $derived(hoverCandidate ? shortcutLabels[hoverCandidate] : "");
  const hoveredToolLabel = $derived(hoverCandidate ? toolLabels[hoverCandidate] : "");
  const hoveredToolText = $derived(hoverCandidate ? `${hoveredToolLabel} (${hoveredShortcutLabel})` : "");
  const showHoveredToolLabel = $derived(Boolean(isToolbarHovered && hoverCandidate));
  const toolLabelText = $derived(showHoveredToolLabel ? hoveredToolText : activeToolLabel);
  const isSelectToolActive = $derived(activeTool === "select");

  const setActiveTool = (tool: ToolId) => {
    if (tool === activeTool) {
      return;
    }

    const wasSelectTool = activeTool === "select";
    activeTool = tool;
    const isSelectTool = tool === "select";
    if (wasSelectTool !== isSelectTool) {
      sendSelectionToggle(isSelectTool);
    }
    activeToolState.set(tool);
  };

  const activateSelectTool = () => {
    if (activeTool === "select") {
      sendSelectionToggle(true);
      return;
    }

    setActiveTool("select");
  };

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return true;
    }

    if (target instanceof HTMLElement && target.isContentEditable) {
      return true;
    }

    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable]'));
  };

  const getShortcutTool = (event: KeyboardEvent): ToolbarControlId | null => {
    if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return null;
    }

    switch (event.code) {
      case "Digit1":
        return "select";
      case "Digit2":
        return "new-element";
      case "Digit3":
        return "selectors";
      case "Digit4":
        return "help";
      case "Digit5":
        return "share";
      default:
        return null;
    }
  };

  const handleShortcut = (tool: ToolbarControlId) => {
    if (tool === "select") {
      activateSelectTool();
      return;
    }

    if (tool === "share") {
      setActiveTool("share");
      return;
    }

    setActiveTool(tool === "help" ? "help" : tool);
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectorDefinitionPattern = new RegExp(
    `\\bconst\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp(pqSelectorReference)}\\s*\\(`,
  );

  const extractSelectorVariableName = (code: string) => {
    const match = code.match(selectorDefinitionPattern);
    return match?.[1] ?? null;
  };

  const saveSelectorDefinition = (payload: SelectorSavePayload): SelectorSaveResult => {
    const rawCode = payload.code.trim();
    if (!rawCode.includes(pqSelectorReference)) {
      const error = `Selector definition must include ${pqSelectorReference}.`;
      setErrorMessage(error);
      return { ok: false, error };
    }

    const existingEntries = get(selectorEntries);
    const existingVariableNames = new Set(
      [...get(elementEntries), ...existingEntries].map((entry) => sanitizeVariableName(entry.name)),
    );

    const variableName = extractSelectorVariableName(rawCode);
    if (!variableName) {
      const error = "Selector definition must include a const assignment.";
      setErrorMessage(error);
      return { ok: false, error };
    }

    if (existingVariableNames.has(sanitizeVariableName(variableName))) {
      const error = `Variable name "${variableName}" already exists.`;
      setErrorMessage(error);
      return { ok: false, error };
    }

    if (!insertDefinitions([rawCode])) {
      const error = "Unable to save selector to the editor.";
      setErrorMessage(error);
      return { ok: false, error };
    }

    setErrorMessage(null);
    return { ok: true };
  };

  const isSelectorSaveMessage = (
    message: unknown,
  ): message is { type: "selector:save"; payload: SelectorSavePayload } => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const payload = (message as { payload?: unknown }).payload;
    if (!payload || typeof payload !== "object") {
      return false;
    }

    return (message as { type?: string }).type === "selector:save";
  };

  onMount(() => {
    const cleanup = attachSelectionListener();

    const handleRuntimeMessage = (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (isSelectorSaveMessage(message)) {
        sendResponse(saveSelectorDefinition(message.payload));
        return true;
      }

      if (!isSidepanelShortcutMessage(message)) {
        return false;
      }

      handleShortcut(message.payload.tool);
      return false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) {
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
    };
  });

  onDestroy(() => {
    sendSelectionToggle(false);
    unsubscribeErrorMessage();
    unsubscribeActiveToolState();
  });

  const toolButtonClasses = (selected: boolean) =>
    "w-8 h-8 !p-0 rounded-lg text-white dark:text-white " +
    (selected ? "bg-accent-500 hover:!opacity-100" : "bg-[#55503E] hover:opacity-55 active:opacity-40");
  const iconSize = "w-5 h-5";
</script>

<main class="flex h-full w-full overflow-hidden bg-[#222121] text-white">
  <div class="h-full w-full min-h-0 min-w-full">
    <div class="flex h-full w-full min-h-0 flex-col">
      <section
        class="relative flex h-[36.56%] w-full shrink-0 flex-col bg-[#282824] shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
        aria-label="Tool panel"
      >
        <div
          class="flex justify-between h-14 px-3 py-2 bg-[#393a34]"
          role="toolbar"
          aria-label="Tool actions"
          tabindex="0"
          onmouseenter={() => {
            isToolbarHovered = true;
          }}
          onmouseleave={() => {
            isToolbarHovered = false;
            hoveredTool = null;
            lastHoveredTool = null;
          }}
        >
          <!-- Left side -->
          <div class="h-full min-w-0 flex flex-1 flex-row gap-3 place-items-center">
            <Button
              class={toolButtonClasses(activeTool === "select")}
              variant="outline"
              aria-label="Toggle selection mode"
              aria-pressed={isSelectToolActive}
              onmouseenter={() => {
                hoveredTool = "select";
                lastHoveredTool = "select";
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={activateSelectTool}
            >
              <MousePointer class={iconSize} />
            </Button>
            <Button
              class={toolButtonClasses(activeTool === "new-element")}
              variant="outline"
              aria-label="New element tool"
              onmouseenter={() => {
                hoveredTool = "new-element";
                lastHoveredTool = "new-element";
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool("new-element")}
            >
              <Plus class={iconSize} />
            </Button>
            <Button
              class="{toolButtonClasses(activeTool === 'selectors')} text-sm"
              variant="outline"
              aria-label="Selectors tool"
              onmouseenter={() => {
                hoveredTool = "selectors";
                lastHoveredTool = "selectors";
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool("selectors")}
            >
              $0
            </Button>
            <span
              class="min-w-0 max-w-full flex-1 truncate transition duration-300 {showHoveredToolLabel
                ? 'text-gray-600 dark:text-gray-400'
                : ''}"
            >
              {toolLabelText}
            </span>
          </div>
          <!-- Right side -->
          <div class="h-full flex flex-row gap-4 place-items-center">
            <Button
              class={toolButtonClasses(activeTool === "help")}
              variant="outline"
              aria-label="Help"
              onmouseenter={() => {
                hoveredTool = "help";
                lastHoveredTool = "help";
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool("help")}
            >
              <CircleQuestionMark class={iconSize} />
            </Button>
            <Button
              class="{toolButtonClasses(activeTool === 'share')} bg-secondary-500"
              variant="outline"
              aria-label="Share tool"
              onmouseenter={() => {
                hoveredTool = "share";
                lastHoveredTool = "share";
              }}
              onmouseleave={() => {
                hoveredTool = null;
              }}
              onclick={() => setActiveTool("share")}
            >
              <Share class={iconSize} />
            </Button>
          </div>
        </div>

        {#if activeTool === "select"}
          <SelectTool />
        {:else if activeTool === "new-element"}
          <NewElementTool />
        {:else if activeTool === "selectors"}
          <SelectorsTool />
        {:else if activeTool === "help"}
          <HelpTool />
        {:else if activeTool === "share"}
          <ShareTool />
        {:else if activeTool === "none"}
          <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4 justify-center place-items-center">
            <p class="text-caption text-gray-500 dark:text-gray-400">Select a tool from the top bar</p>
          </div>
        {:else}
          <div class="flex h-full w-full flex-1 flex-col gap-4 px-4 py-4">
            <p class="text-body">
              Unknown tool: {activeTool}
            </p>
          </div>
        {/if}
      </section>

      <CodeEditorTool />

      {#if errorMessageValue}
        <div class="w-full shrink-0 bg-[#3b1d1d] px-[4%] py-[2%] text-caption text-[#f5b1b1]">
          {errorMessageValue}
        </div>
      {/if}
    </div>
  </div>
</main>
