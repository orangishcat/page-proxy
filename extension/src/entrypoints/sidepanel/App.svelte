<script lang="ts">
  import { onMount } from "svelte";
  import { Tooltip } from "bits-ui";
  import { browser } from "wxt/browser";
  import { CircleQuestionMark, MousePointer, Plus, Share } from "lucide-svelte";

  import { get } from "svelte/store";
  import SelectTool from "./tools/SelectTool.svelte";
  import CreateTool from "./tools/CreateTool.svelte";
  import ExportTool from "./tools/ExportTool.svelte";
  import HelpTool from "./tools/HelpTool.svelte";
  import SelectorsTool from "./tools/SelectorsTool.svelte";
  import CodeEditorTool from "./tools/CodeEditorTool.svelte";
  import Button from "@/lib/components/Button.svelte";
  import { detectBrowserSupport } from "@/lib/utils/browser-support";
  import { attachSelectionListener, sendSelectionToggle } from "./tools/select-tool/actions";
  import { errorMessage, setErrorMessage, setSuccessMessage, successMessage } from "./tools/tool-errors";
  import { isGrantPermissionRequestMessage } from "@/lib/grant-permissions";
  import { isSidepanelShortcutMessage, type SidepanelShortcutId } from "@/lib/sidepanel-shortcuts";
  import type { SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { elementEntries, insertDefinitions, sanitizeVariableName, selectorEntries } from "./tools/code-editor/state";
  import { grantPermissionRequest } from "./tools/grant-permissions/state";
  import { ensureCodeRunnerUserscript } from "@/lib/userscript-runner";
  import {
    activeToolState,
    readHelpBannerDismissedSetting,
    readToolPanelHeightSetting,
    readUserscriptReloadBannerDismissedSetting,
    saveHelpBannerDismissedSetting,
    saveToolPanelHeightSetting,
    saveUserscriptReloadBannerDismissedSetting,
    type ToolId,
  } from "./tools/state-storage";

  type ToolbarControlId = SidepanelShortcutId;

  const toolLabels: Record<ToolId, string> = {
    select: "Select",
    create: "Create",
    selectors: "Selectors",
    share: "Export",
    help: "Help",
    none: "",
  };

  let activeTool = $state<ToolId>("none");
  let hoveredTool = $state<ToolbarControlId | null>(null);
  let lastHoveredTool = $state<ToolbarControlId | null>(null);
  let isToolbarHovered = $state(false);
  let errorMessageValue = $state<string | null>(null);
  let successMessageValue = $state<string | null>(null);
  let showUnsupportedBrowserBanner = $state(false);
  let showFirefoxExperimentalBanner = $state(false);
  let showUserscriptEnableBanner = $state(false);
  let showUserscriptReloadBanner = $state(false);
  let userscriptEnableWithFirefoxPermissions = $state(false);
  let userscriptReloadBannerDismissed = $state(false);
  let showHelpBanner = $state(true);
  let toolPanelHeightPx = $state<number | null>(null);
  let toolPanelLayout = $state<HTMLDivElement | null>(null);
  let toolPanelSection = $state<HTMLElement | null>(null);
  let toolPanelResizeHandle = $state<HTMLDivElement | null>(null);
  let errorBannerElement = $state<HTMLDivElement | null>(null);
  let resizePointerId = $state<number | null>(null);
  let isResizingToolPanel = $state(false);

  const minToolPanelHeightPx = 300;
  const maxToolPanelHeightPx = 600;

  let unsubscribeErrorMessage = () => {};
  let unsubscribeSuccessMessage = () => {};
  let unsubscribeActiveToolState = () => {};

  const activeToolLabel = $derived(toolLabels[activeTool]);
  const shortcutLabels: Record<ToolbarControlId, string> = {
    select: "⇧1",
    create: "⇧2",
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
  const toolPanelStyle = $derived(
    toolPanelHeightPx === null
      ? undefined
      : `height: ${toolPanelHeightPx}px; min-height: ${minToolPanelHeightPx}px; max-height: ${maxToolPanelHeightPx}px;`,
  );

  const setActiveTool = (tool: ToolId) => {
    if (tool === activeTool) {
      return;
    }

    const wasSelectTool = activeTool === "select";
    activeTool = tool;
    const isSelectTool = tool === "select";
    if (wasSelectTool && !isSelectTool) {
      sendSelectionToggle(false);
    }
    activeToolState.set(tool);
  };

  const activateSelectTool = () => {
    sendSelectionToggle(true);
    if (activeTool === "select") {
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

  const isMonacoEditorTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest(".monaco-editor, .monaco-diff-editor"));
  };

  const isCodeEditorFocused = (eventTarget: EventTarget | null) => {
    if (isMonacoEditorTarget(eventTarget) || isMonacoEditorTarget(document.activeElement)) {
      return true;
    }

    return (
      document.querySelector(".monaco-editor textarea.inputarea:focus, .monaco-diff-editor textarea.inputarea:focus") !==
      null
    );
  };

  const getShortcutTool = (event: KeyboardEvent): ToolbarControlId | null => {
    if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return null;
    }

    switch (event.code) {
      case "Digit1":
        return "select";
      case "Digit2":
        return "create";
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
    `\\bconst\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp("pq.selector")}\\s*\\(`,
  );

  const extractSelectorVariableName = (code: string) => {
    const match = code.match(selectorDefinitionPattern);
    return match?.[1] ?? null;
  };

  const saveSelectorDefinition = (payload: SelectorSavePayload): SelectorSaveResult => {
    const rawCode = payload.code.trim();
    if (!rawCode.includes("pq.selector")) {
      const error = `Selector definition must include pq.selector.`;
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

  const setToolPanelHeightFromClientY = (clientY: number) => {
    if (!toolPanelSection) {
      return;
    }

    toolPanelHeightPx = clientY;
  };

  const startToolPanelResize = (event: PointerEvent) => {
    if (event.button !== 0 || !toolPanelResizeHandle) {
      return;
    }

    event.preventDefault();
    resizePointerId = event.pointerId;
    isResizingToolPanel = true;
    toolPanelResizeHandle.setPointerCapture(event.pointerId);
    setToolPanelHeightFromClientY(event.clientY);
  };

  const updateToolPanelResize = (event: PointerEvent) => {
    if (!isResizingToolPanel || event.pointerId !== resizePointerId) {
      return;
    }

    event.preventDefault();
    setToolPanelHeightFromClientY(event.clientY);
  };

  const finishToolPanelResize = (event: PointerEvent) => {
    if (event.pointerId !== resizePointerId || !toolPanelResizeHandle) {
      return;
    }

    if (toolPanelResizeHandle.hasPointerCapture(event.pointerId)) {
      toolPanelResizeHandle.releasePointerCapture(event.pointerId);
    }

    isResizingToolPanel = false;
    resizePointerId = null;
    if (toolPanelHeightPx !== null) {
      void saveToolPanelHeightSetting(toolPanelHeightPx);
    }
  };

  onMount(() => {
    void detectBrowserSupport().then(({ browser: supportedBrowser, supported }) => {
      showUnsupportedBrowserBanner = !supported;
      showFirefoxExperimentalBanner = supportedBrowser === "firefox";
      userscriptEnableWithFirefoxPermissions = supportedBrowser === "firefox";
    });
    void Promise.all([ensureCodeRunnerUserscript(), readUserscriptReloadBannerDismissedSetting()]).then(
      ([status, reloadBannerDismissed]) => {
        userscriptReloadBannerDismissed = reloadBannerDismissed;
        if (!status.ok && status.needsEnablement) {
          showUserscriptEnableBanner = true;
          return;
        }

        showUserscriptReloadBanner = status.ok && !reloadBannerDismissed;
      },
    );

    void readHelpBannerDismissedSetting().then((dismissed) => {
      showHelpBanner = !dismissed;
    });

    toolPanelHeightPx = minToolPanelHeightPx;
    void readToolPanelHeightSetting().then((storedHeight) => {
      if (storedHeight === null) {
        return;
      }

      toolPanelHeightPx = storedHeight;
    });

    unsubscribeErrorMessage = errorMessage.subscribe((value) => {
      errorMessageValue = value;
    });
    unsubscribeSuccessMessage = successMessage.subscribe((value) => {
      successMessageValue = value;
    });
    unsubscribeActiveToolState = activeToolState.subscribe((tool) => {
      if (tool === activeTool) {
        return;
      }

      const wasSelectTool = activeTool === "select";
      activeTool = tool;
      const isSelectTool = tool === "select";
      if (wasSelectTool && !isSelectTool) {
        sendSelectionToggle(false);
      }
    });

    sendSelectionToggle(false);

    const cleanup = attachSelectionListener();

    const handleRuntimeMessage = (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (isSelectorSaveMessage(message)) {
        sendResponse(saveSelectorDefinition(message.payload));
        return true;
      }

      if (isGrantPermissionRequestMessage(message)) {
        grantPermissionRequest.set({
          websiteGlob: message.payload.websiteGlob,
          grants: message.payload.grants,
        });
        setActiveTool("help");
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
        sendSelectionToggle(false);
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
      unsubscribeErrorMessage();
      unsubscribeSuccessMessage();
      unsubscribeActiveToolState();
    };
  });

  const toolButtonClasses = (selected: boolean) =>
    "w-8 h-8 !p-0 rounded-lg text-white dark:text-white " +
    (selected ? "bg-accent-500 hover:!opacity-100" : "bg-[#55503E] hover:opacity-55 active:opacity-40");
  const iconSize = "w-5 h-5";

  const dismissFirefoxExperimentalBanner = () => {
    showFirefoxExperimentalBanner = false;
  };

  const dismissUserscriptEnableBanner = () => {
    showUserscriptEnableBanner = false;
  };

  const dismissUserscriptReloadBanner = () => {
    showUserscriptReloadBanner = false;
    userscriptReloadBannerDismissed = true;
    void saveUserscriptReloadBannerDismissedSetting(true);
  };

  const requestFirefoxUserscriptPermission = (event: MouseEvent) => {
    event.preventDefault();
    void browser.permissions
      .request({ permissions: ["userScripts"] })
      .then((granted) => {
        if (!granted) {
          setErrorMessage("Userscripts API permission was not granted.");
          return;
        }

        return ensureCodeRunnerUserscript().then((status) => {
          if (!status.ok) {
            setErrorMessage(status.message);
            return;
          }

          showUserscriptEnableBanner = false;
          showUserscriptReloadBanner = !userscriptReloadBannerDismissed;
          setErrorMessage(null);
          setSuccessMessage("Userscripts API enabled.");
        });
      })
      .catch(() => {
        setErrorMessage("Unable to request Userscripts API permission.");
      });
  };

  const dismissUnsupportedBrowserBanner = () => {
    showUnsupportedBrowserBanner = false;
  };

  const dismissHelpBanner = () => {
    showHelpBanner = false;
    void saveHelpBannerDismissedSetting(true);
  };

  const dismissStatusBanner = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };
</script>

<Tooltip.Provider>
  <main class="flex h-full w-full overflow-hidden bg-[#222121] text-white">
    <div class="h-full w-full min-h-0 min-w-full">
      <div class="flex h-full w-full min-h-0 flex-col" bind:this={toolPanelLayout}>
        {#if showUnsupportedBrowserBanner}
          <div
            class="flex w-full max-w-none shrink-0 items-center gap-2 bg-red-700 px-4 py-2 text-caption text-red-100"
          >
            <span class="flex-1"
              >Your browser is not supported. Please use Chrome, Brave, or Firefox to avoid unexpected issues.</span
            >
            <button
              type="button"
              class="rounded border border-red-200 px-2 py-0.5 text-caption text-red-100 hover:bg-red-800"
              aria-label="Dismiss unsupported browser notice"
              onclick={dismissUnsupportedBrowserBanner}
            >
              Dismiss
            </button>
          </div>
        {/if}

        {#if showFirefoxExperimentalBanner}
          <div
            class="flex w-full max-w-none shrink-0 items-center gap-2 bg-[#3d341d] px-4 py-2 text-caption text-[#f4de9e]"
          >
            <span class="flex-1">Firefox support is experimental.</span>
            <button
              type="button"
              class="rounded border border-[#8f7a3c] px-2 py-0.5 text-caption text-[#f4de9e] hover:bg-[#5c4f28]"
              aria-label="Dismiss Firefox experimental notice"
              onclick={dismissFirefoxExperimentalBanner}
            >
              Dismiss
            </button>
          </div>
        {/if}

        {#if showUserscriptEnableBanner}
          <div
            class="flex w-full max-w-none shrink-0 items-center gap-2 bg-[#4a2a0f] px-4 py-2 text-caption text-[#ffd8b0]"
          >
            <span class="flex w-full flex-1 flex-wrap items-center gap-1">
              <span>Page Proxy needs the Userscripts API to run untrusted scripts.</span>
              {#if userscriptEnableWithFirefoxPermissions}
                <a
                  href="https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request"
                  target="_blank"
                  rel="noreferrer"
                  class="font-semibold text-[#ffd8b0] underline underline-offset-2 hover:opacity-80"
                  onclick={requestFirefoxUserscriptPermission}
                >
                  Enable it here.
                </a>
              {:else}
                <a
                  href="https://developer.chrome.com/docs/extensions/reference/api/userScripts#chrome_versions_138_and_newer_allow_user_scripts_toggle"
                  target="_blank"
                  rel="noreferrer"
                  class="font-semibold text-[#ffd8b0] underline underline-offset-2 hover:opacity-80"
                >
                  Instructions to enable
                </a>
              {/if}
            </span>
            <button
              type="button"
              class="rounded border border-[#8f5f31] px-2 py-0.5 text-caption text-[#ffd8b0] hover:bg-[#5f3918]"
              aria-label="Dismiss Userscripts API notice"
              onclick={dismissUserscriptEnableBanner}
            >
              Dismiss
            </button>
          </div>
        {/if}

        {#if !showUserscriptEnableBanner && showUserscriptReloadBanner}
          <div
            class="flex w-full max-w-none shrink-0 items-center gap-2 bg-[#1e2f46] px-4 py-2 text-caption text-[#d4e9ff]"
          >
            <span class="flex-1">Note: you may need to reload all your tabs for the Userscript API to take effect.</span>
            <button
              type="button"
              class="rounded border border-[#4c6f98] px-2 py-0.5 text-caption text-[#d4e9ff] hover:bg-[#27405f]"
              aria-label="Dismiss Userscript reload notice"
              onclick={dismissUserscriptReloadBanner}
            >
              Dismiss
            </button>
          </div>
        {/if}

        {#if !showUnsupportedBrowserBanner && showHelpBanner}
          <div
            class="flex w-full max-w-none shrink-0 items-center gap-2 bg-[#1e2f46] px-4 py-2 text-caption text-[#d4e9ff]"
          >
            <span class="flex w-full flex-1 flex-wrap items-center gap-1">
              <span>Something not working? Check the Help tool</span>
              <CircleQuestionMark class="h-4 w-4" aria-hidden="true" />
              <span>for troubleshooting or</span>
              <a
                href="https://github.com/orangishcat/page-proxy"
                target="_blank"
                rel="noreferrer"
                class="font-semibold text-[#d4e9ff] underline underline-offset-2 hover:opacity-80"
              >
                report a bug
              </a>
              <span>.</span>
            </span>
            <button
              type="button"
              class="rounded border border-[#4c6f98] px-2 py-0.5 text-caption text-[#d4e9ff] hover:bg-[#27405f]"
              aria-label="Dismiss help notice"
              onclick={dismissHelpBanner}
            >
              Dismiss
            </button>
          </div>
        {/if}

        <section
          class="relative flex w-full shrink-0 flex-col bg-[#282824]"
          aria-label="Tool panel"
          bind:this={toolPanelSection}
          style={toolPanelStyle}
        >
          <div
            class="flex justify-between h-12 px-3 py-2 bg-[#393a34]"
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
                class={toolButtonClasses(activeTool === "create")}
                variant="outline"
                aria-label="Create tool"
                onmouseenter={() => {
                  hoveredTool = "create";
                  lastHoveredTool = "create";
                }}
                onmouseleave={() => {
                  hoveredTool = null;
                }}
                onclick={() => setActiveTool("create")}
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
                aria-label="Export tool"
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
          {:else if activeTool === "create"}
            <CreateTool />
          {:else if activeTool === "selectors"}
            <SelectorsTool />
          {:else if activeTool === "help"}
            <HelpTool />
          {:else if activeTool === "share"}
            <ExportTool />
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

        <div
          class="h-2 w-full shrink-0 cursor-row-resize bg-[#282824] transition-colors hover:bg-[#4a4b45] active:bg-accent-500/40"
          role="separator"
          aria-label="Resize tool panel"
          aria-orientation="horizontal"
          bind:this={toolPanelResizeHandle}
          onpointerdown={startToolPanelResize}
          onpointermove={updateToolPanelResize}
          onpointerup={finishToolPanelResize}
          onpointercancel={finishToolPanelResize}
        ></div>

        <CodeEditorTool />

        {#if errorMessageValue || successMessageValue}
          <div
            class={`w-full shrink-0 px-4 py-2 text-caption ${
              successMessageValue ? "bg-[#1f3a22] text-[#b8f3bf]" : "bg-[#3b1d1d] text-[#f5b1b1]"
            }`}
            bind:this={errorBannerElement}
          >
            <div class="flex items-center gap-2">
              <span class="flex-1">{successMessageValue ?? errorMessageValue}</span>
              <button
                type="button"
                class="rounded border border-current px-2 py-0.5 text-caption hover:bg-black/10"
                aria-label="Dismiss status message"
                onclick={dismissStatusBanner}
              >
                Dismiss
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </main>
</Tooltip.Provider>
