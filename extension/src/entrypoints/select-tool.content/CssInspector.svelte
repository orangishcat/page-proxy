<script lang="ts">
  import Button from "@/lib/components/Button.svelte";
  import type { ElementInfo, SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { Tooltip } from "bits-ui";
  import { RotateCw } from "lucide-svelte";
  import { onDestroy, onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { createMonacoEditor, type MonacoCodeEditorHandle, updateMonacoEditorValue } from "@/lib/code-editor";
  import CopyablePropertyText from "./CopyablePropertyText.svelte";
  import { parseCssSelectorParts, type CssSelectorPart } from "./css-inspector";
  import {
    buildCssDocument,
    buildInjectCssSnippet,
    normalizeSelectorFromCssEditor,
    parseCssDeclarations,
    readComputedStyleEntries,
    readDeclarationSourceFromCssEditor,
    readSelectorSourceFromCssEditor,
    removeCssDeclaration,
    upsertCssDeclaration,
  } from "./css-editor-utils";
  import { getSelectorPreviewState } from "./popup/css-preview";

  type PropertyItem = {
    key: string;
    label: string;
    value: string;
    rawValue: string | ElementInfo["boundingBox"];
    primary: boolean;
  };

  type CssComputedStyleProperty = {
    key: string;
    value: string;
    originalValue: string;
    edited: boolean;
    originalOrder: number;
    declarationOrder: number | null;
  };

  type Props = {
    info: ElementInfo;
    propertyItems: PropertyItem[];
    targetElement: Element | null;
    onSave: (payload: SelectorSavePayload) => Promise<SelectorSaveResult>;
    onCancel: () => void;
    baseSelector: string;
    active?: boolean;
    onBaseSelectorChange?: (nextSelector: string) => void;
    onVisibilityChange?: (hidden: boolean) => void;
  };

  let {
    info,
    propertyItems,
    targetElement,
    onSave,
    onCancel,
    baseSelector,
    active = false,
    onBaseSelectorChange,
    onVisibilityChange,
  }: Props = $props();

  let cssEditorHost = $state<HTMLDivElement | null>(null);
  let cssEditorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let cssEditorValue = $state("");
  let hoveredCssOffset = $state<number | null>(null);
  let isMatchPreviewing = $state(false);
  let isCssStylePreviewing = $state(false);
  let isCssEditorFocused = $state(false);
  let highlightedPreviewElements: Element[] = [];
  let highlightedPreviewCount = $state(0);
  let matchingElementCount = $state(0);
  let cssPreviewErrorMessage = $state<string | null>(null);
  let highlightNoticeElement: HTMLDivElement | null = null;
  let cssStylePreviewElement: HTMLStyleElement | null = null;
  let disposeCssCursorChange: (() => void) | null = null;
  let disposeCssFocus: (() => void) | null = null;
  let disposeCssBlur: (() => void) | null = null;

  let propertySearchTerm = $state("");
  let errorMessage = $state("");

  let computedValueDrafts = $state<Record<string, string>>({});
  const computedInputRefs = new SvelteMap<string, HTMLInputElement>();
  const noMatchingElementsErrorMessages = new Set([
    "CSS selector matches no elements.",
    "Selector does not match any elements",
  ]);

  const hoveredPreviewClass = "pp-hovered";
  const hasNoMatchingElements = $derived.by(
    () => cssPreviewErrorMessage !== null && noMatchingElementsErrorMessages.has(cssPreviewErrorMessage),
  );
  const formatMatchingElementsLabel = (count: number) => `${count} matching element${count === 1 ? "" : "s"}`;

  const computedValueInput = (node: HTMLInputElement, key: string) => {
    let currentKey = key;
    computedInputRefs.set(currentKey, node);

    return {
      update(nextKey: string) {
        if (nextKey === currentKey) {
          return;
        }
        computedInputRefs.delete(currentKey);
        currentKey = nextKey;
        computedInputRefs.set(currentKey, node);
      },
      destroy() {
        computedInputRefs.delete(currentKey);
      },
    };
  };

  const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max)}…` : value);

  const cssSelectorSource = $derived.by(() => readSelectorSourceFromCssEditor(cssEditorValue));
  const cssSelectorParts = $derived.by(() => parseCssSelectorParts(cssSelectorSource));

  const hasNthOfTypeRule = $derived.by(() =>
    cssSelectorParts.some((part) => part.type === "pseudo" && /^:nth-of-type\(/i.test(part.text)),
  );

  const cssPropertyItems = $derived.by(() =>
    propertyItems.filter((item) => item.key !== "selector" && item.key !== "bbox" && item.key !== "innerText"),
  );

  const baseComputedStyleEntries = $derived.by(() => readComputedStyleEntries(targetElement));
  const cssDeclarationEntries = $derived.by(() => parseCssDeclarations(readDeclarationSourceFromCssEditor(cssEditorValue)));

  const cssComputedStyleProperties = $derived.by<CssComputedStyleProperty[]>(() => {
    const baseValueByKey = new Map(baseComputedStyleEntries.map((entry) => [entry.key, entry.value]));
    const baseOrderByKey = new Map(baseComputedStyleEntries.map((entry) => [entry.key, entry.originalOrder]));
    const declarationByKey = new Map(cssDeclarationEntries.map((entry) => [entry.key, entry]));
    const allKeys = new Set<string>([...baseValueByKey.keys(), ...declarationByKey.keys()]);
    const entries: CssComputedStyleProperty[] = [];

    allKeys.forEach((key) => {
      const declaration = declarationByKey.get(key);
      const originalValue = baseValueByKey.get(key) ?? "";
      const value = declaration?.value ?? originalValue;
      const edited = declaration !== undefined && value !== originalValue;
      entries.push({
        key,
        value,
        originalValue,
        edited,
        originalOrder: baseOrderByKey.get(key) ?? Number.MAX_SAFE_INTEGER,
        declarationOrder: declaration?.order ?? null,
      });
    });

    entries.sort((left, right) => {
      if (left.edited !== right.edited) {
        return left.edited ? -1 : 1;
      }
      if (left.originalOrder !== right.originalOrder) {
        return left.originalOrder - right.originalOrder;
      }
      const leftDeclarationOrder = left.declarationOrder ?? Number.MAX_SAFE_INTEGER;
      const rightDeclarationOrder = right.declarationOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftDeclarationOrder !== rightDeclarationOrder) {
        return leftDeclarationOrder - rightDeclarationOrder;
      }
      return left.key.localeCompare(right.key);
    });

    return entries;
  });

  const activeCssPart = $derived.by<CssSelectorPart | null>(() => {
    const currentOffset = hoveredCssOffset;
    if (currentOffset === null || currentOffset >= cssSelectorSource.length) {
      return null;
    }

    return cssSelectorParts.find((part) => currentOffset >= part.startOffset && currentOffset < part.endOffset) ?? null;
  });

  const normalizedSearchTerm = $derived.by(() => propertySearchTerm.trim().toLowerCase());

  const filteredPropertyItems = $derived.by(() => {
    const searchTerm = normalizedSearchTerm;
    if (!searchTerm) {
      return cssPropertyItems;
    }

    return cssPropertyItems.filter(
      (property) =>
        property.key.toLowerCase().includes(searchTerm) || property.value.toLowerCase().includes(searchTerm),
    );
  });

  const filteredComputedStyleProperties = $derived.by(() => {
    const searchTerm = normalizedSearchTerm;
    if (!searchTerm) {
      return cssComputedStyleProperties;
    }

    return cssComputedStyleProperties.filter(
      (property) =>
        property.key.toLowerCase().includes(searchTerm) || property.value.toLowerCase().includes(searchTerm),
    );
  });

  const getDraftValue = (key: string, fallbackValue: string) => computedValueDrafts[key] ?? fallbackValue;

  const setDraftValue = (key: string, value: string) => {
    computedValueDrafts = {
      ...computedValueDrafts,
      [key]: value,
    };
  };

  const clearDraftValue = (key: string) => {
    if (!(key in computedValueDrafts)) {
      return;
    }
    const { [key]: _ignored, ...rest } = computedValueDrafts;
    computedValueDrafts = rest;
  };

  const focusComputedValueInput = (key: string) => {
    const input = computedInputRefs.get(key);
    if (!input) {
      return;
    }
    input.focus();
    input.select();
  };

  const commitComputedValue = (key: string, currentValue: string) => {
    const nextValue = getDraftValue(key, currentValue).trim();
    clearDraftValue(key);

    if (nextValue === currentValue.trim()) {
      return;
    }

    handleCssComputedPropertyChange(key, nextValue);
  };

  const revertComputedValue = (key: string) => {
    clearDraftValue(key);
    handleCssComputedPropertyRevert(key);
  };

  const updateCssDocumentDeclarations = (nextDeclarationSource: string) => {
    if (!cssEditorHandle) {
      return;
    }

    const currentCssDocument = cssEditorHandle.editor.getValue();
    const selectorValue = normalizeSelectorFromCssEditor(currentCssDocument);
    if (!selectorValue) {
      return;
    }

    const nextCssDocument = buildCssDocument(selectorValue, nextDeclarationSource);
    if (nextCssDocument === currentCssDocument) {
      return;
    }

    updateMonacoEditorValue(cssEditorHandle, nextCssDocument);
    cssEditorValue = nextCssDocument;
  };

  const handleCssComputedPropertyChange = (key: string, value: string) => {
    const declarationSource = readDeclarationSourceFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    const nextDeclarationSource = upsertCssDeclaration(declarationSource, key, value);
    updateCssDocumentDeclarations(nextDeclarationSource);
  };

  const handleCssComputedPropertyRevert = (key: string) => {
    const declarationSource = readDeclarationSourceFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    const nextDeclarationSource = removeCssDeclaration(declarationSource, key);
    updateCssDocumentDeclarations(nextDeclarationSource);
  };

  const removeNthOfTypeFromCssSelector = () => {
    if (!cssEditorHandle) {
      return;
    }

    const currentCssDocument = cssEditorHandle.editor.getValue();
    const selectorSource = readSelectorSourceFromCssEditor(currentCssDocument);
    const nthOfTypePattern = /:nth-of-type\(\s*[^)]*\s*\)/gi;
    if (!nthOfTypePattern.test(selectorSource)) {
      return;
    }

    const declarationValue = readDeclarationSourceFromCssEditor(currentCssDocument);
    const selectorWithoutNthOfType = selectorSource.replace(nthOfTypePattern, "");
    const normalizedSelector = normalizeSelectorFromCssEditor(selectorWithoutNthOfType);
    if (!normalizedSelector) {
      cssPreviewErrorMessage = "CSS selector is invalid.";
      return;
    }

    const nextCssDocument = buildCssDocument(normalizedSelector, declarationValue);
    const fullRange = cssEditorHandle.model.getFullModelRange();
    cssEditorHandle.editor.pushUndoStop();
    cssEditorHandle.editor.executeEdits("page-proxy-remove-nth-of-type", [
      {
        range: fullRange,
        text: nextCssDocument,
        forceMoveMarkers: true,
      },
    ]);
    cssEditorHandle.editor.pushUndoStop();
    cssEditorHandle.editor.focus();
  };

  const clearPreviewHighlights = () => {
    highlightedPreviewElements.forEach((element) => {
      element.classList.remove(hoveredPreviewClass);
    });
    highlightedPreviewElements = [];
    highlightedPreviewCount = 0;
  };

  const updateCssPreviewState = () => {
    const selector = normalizeSelectorFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    const previewState = getSelectorPreviewState(selector);
    matchingElementCount = previewState.matchingElements.length;
    cssPreviewErrorMessage = previewState.error;
  };

  const applyPreviewHighlights = () => {
    clearPreviewHighlights();

    const selector = normalizeSelectorFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    const previewState = getSelectorPreviewState(selector);
    matchingElementCount = previewState.matchingElements.length;
    cssPreviewErrorMessage = previewState.error;
    if (previewState.matchingElements.length === 0) {
      return;
    }

    highlightedPreviewElements = previewState.matchingElements;
    highlightedPreviewCount = highlightedPreviewElements.length;
    highlightedPreviewElements.forEach((element) => {
      element.classList.add(hoveredPreviewClass);
    });
  };

  const removeCssStylePreview = () => {
    cssStylePreviewElement?.remove();
    cssStylePreviewElement = null;
  };

  const applyCssStylePreview = () => {
    removeCssStylePreview();

    const currentCssDocument = cssEditorHandle?.editor.getValue() ?? cssEditorValue;
    const selector = normalizeSelectorFromCssEditor(currentCssDocument);
    const declarations = readDeclarationSourceFromCssEditor(currentCssDocument);
    if (!declarations.trim()) {
      cssPreviewErrorMessage = "Add at least one CSS declaration to preview applied styles.";
      return;
    }

    const previewState = getSelectorPreviewState(selector);
    matchingElementCount = previewState.matchingElements.length;
    cssPreviewErrorMessage = previewState.error;
    if (previewState.matchingElements.length === 0) {
      return;
    }

    const previewStyleElement = document.createElement("style");
    previewStyleElement.className = "pp-no-select-tool";
    previewStyleElement.setAttribute("data-page-proxy", "css-style-preview");
    previewStyleElement.textContent = `${selector} {\n${declarations}\n}`;
    (document.head ?? document.documentElement).appendChild(previewStyleElement);
    cssStylePreviewElement = previewStyleElement;
  };

  const stopMatchPreview = () => {
    if (!isMatchPreviewing) {
      return;
    }
    isMatchPreviewing = false;
    clearPreviewHighlights();
  };

  const stopCssStylePreview = () => {
    if (!isCssStylePreviewing) {
      return;
    }
    isCssStylePreviewing = false;
    removeCssStylePreview();
  };

  const stopPreviewModes = () => {
    stopMatchPreview();
    stopCssStylePreview();
  };

  const removeHighlightNotice = () => {
    highlightNoticeElement?.remove();
    highlightNoticeElement = null;
  };

  const showHighlightNotice = (matchCount: number) => {
    if (!highlightNoticeElement?.isConnected) {
      const notice = document.createElement("div");
      notice.className = "pp-no-select-tool";
      notice.style.position = "fixed";
      notice.style.top = "1em";
      notice.style.right = "1em";
      notice.style.zIndex = "2147483647";
      notice.style.pointerEvents = "none";
      notice.style.padding = "0.625em 0.75em";
      notice.style.borderRadius = "0.5em";
      notice.style.border = "0.0625em solid #86d24b";
      notice.style.background = "rgba(22, 30, 22, 0.96)";
      notice.style.color = "#e8f7e8";
      notice.style.fontFamily = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";
      notice.style.setProperty("font-size", "16px", "important");
      notice.style.lineHeight = "1.3";
      notice.style.boxShadow = "0 0.25em 0.75em rgba(0, 0, 0, 0.35)";
      document.body.appendChild(notice);
      highlightNoticeElement = notice;
    }

    highlightNoticeElement.textContent = `${matchCount} matching elements are highlighted in lime.`;
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (!active || isCssEditorFocused) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "z") {
      if (!isMatchPreviewing) {
        isMatchPreviewing = true;
        applyPreviewHighlights();
      }
      return;
    }

    if (key === "x") {
      if (!isCssStylePreviewing) {
        isCssStylePreviewing = true;
        applyCssStylePreview();
      }
    }
  };

  const handleWindowKeyUp = (event: KeyboardEvent) => {
    if (!active) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "z") {
      stopMatchPreview();
      return;
    }
    if (key === "x") {
      stopCssStylePreview();
    }
  };

  const handleWindowBlur = () => {
    stopPreviewModes();
  };

  const setupCssEditor = () => {
    if (!cssEditorHost || cssEditorHandle) {
      return;
    }

    const initialDeclarationValue = readDeclarationSourceFromCssEditor(cssEditorValue);
    const initialSelectorValue = baseSelector.trim() || info.selector;
    const initialCssEditorValue =
      cssEditorValue.trim().length > 0 ? cssEditorValue : buildCssDocument(initialSelectorValue, initialDeclarationValue);

    cssEditorValue = initialCssEditorValue;
    cssEditorHandle = createMonacoEditor(cssEditorHost, initialCssEditorValue, {
      language: "css",
      modelUri: "inmemory://page-proxy/selector-popup-base-selector.css",
      lineNumbers: "on",
      wordWrap: "on",
      onChange: (nextValue) => {
        cssEditorValue = nextValue;

        const normalizedSelectorValue = normalizeSelectorFromCssEditor(nextValue);
        if (normalizedSelectorValue.length === 0) {
          errorMessage = "CSS selector cannot be empty.";
          updateCssPreviewState();
          return;
        }

        onBaseSelectorChange?.(normalizedSelectorValue);
        errorMessage = "";

        if (isMatchPreviewing) {
          applyPreviewHighlights();
        }
        if (isCssStylePreviewing) {
          applyCssStylePreview();
        }

        updateCssPreviewState();
      },
      editorOptions: {
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
      },
    });

    const cursorChangeDisposable = cssEditorHandle.editor.onDidChangeCursorPosition((event) => {
      hoveredCssOffset = cssEditorHandle?.model.getOffsetAt(event.position) ?? null;
    });
    disposeCssCursorChange = () => {
      cursorChangeDisposable.dispose();
      disposeCssCursorChange = null;
    };

    const initialCursorPosition = cssEditorHandle.editor.getPosition();
    if (initialCursorPosition) {
      hoveredCssOffset = cssEditorHandle.model.getOffsetAt(initialCursorPosition);
    } else {
      hoveredCssOffset = null;
    }

    const focusDisposable = cssEditorHandle.editor.onDidFocusEditorText(() => {
      isCssEditorFocused = true;
    });
    disposeCssFocus = () => {
      focusDisposable.dispose();
      disposeCssFocus = null;
    };

    const blurDisposable = cssEditorHandle.editor.onDidBlurEditorText(() => {
      isCssEditorFocused = false;
    });
    disposeCssBlur = () => {
      blurDisposable.dispose();
      disposeCssBlur = null;
    };

    isCssEditorFocused = cssEditorHandle.editor.hasTextFocus();
  };

  const handleSave = async () => {
    const currentCssDocument = cssEditorHandle?.editor.getValue() ?? cssEditorValue;
    const selectorValue = normalizeSelectorFromCssEditor(currentCssDocument);
    if (selectorValue.length === 0) {
      errorMessage = "Add a valid CSS selector before saving.";
      return;
    }

    const declarationValue = readDeclarationSourceFromCssEditor(currentCssDocument);
    const injectSnippet = buildInjectCssSnippet(selectorValue, declarationValue);

    const nextCssDocument = buildCssDocument(selectorValue, declarationValue);
    cssEditorValue = nextCssDocument;
    if (cssEditorHandle && cssEditorHandle.editor.getValue() !== nextCssDocument) {
      updateMonacoEditorValue(cssEditorHandle, nextCssDocument);
    }

    const payload: SelectorSavePayload = {
      name: null,
      code: injectSnippet,
      baseSelector: selectorValue,
    };

    const result = await onSave(payload);
    if (!result.ok) {
      errorMessage = result.error;
      return;
    }

    errorMessage = "";
  };

  onMount(() => {
    setupCssEditor();
    window.addEventListener("keydown", handleWindowKeyDown, { capture: true });
    window.addEventListener("keyup", handleWindowKeyUp, { capture: true });
    window.addEventListener("blur", handleWindowBlur, { capture: true });
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleWindowKeyDown, { capture: true });
    window.removeEventListener("keyup", handleWindowKeyUp, { capture: true });
    window.removeEventListener("blur", handleWindowBlur, { capture: true });
    stopPreviewModes();
    removeHighlightNotice();
    onVisibilityChange?.(false);

    if (disposeCssCursorChange) {
      disposeCssCursorChange();
    }
    if (disposeCssFocus) {
      disposeCssFocus();
    }
    if (disposeCssBlur) {
      disposeCssBlur();
    }
    if (cssEditorHandle) {
      cssEditorHandle.dispose();
      cssEditorHandle = null;
    }
  });

  $effect(() => {
    if (!cssEditorHandle) {
      return;
    }

    const normalizedBaseSelector = baseSelector.trim();
    if (!normalizedBaseSelector) {
      return;
    }

    const currentCssDocument = cssEditorHandle.editor.getValue();
    const currentSelectorValue = normalizeSelectorFromCssEditor(currentCssDocument);
    if (currentSelectorValue !== normalizedBaseSelector) {
      const declarationValue = readDeclarationSourceFromCssEditor(currentCssDocument);
      const syncedCssDocument = buildCssDocument(normalizedBaseSelector, declarationValue);
      updateMonacoEditorValue(cssEditorHandle, syncedCssDocument);
      cssEditorValue = syncedCssDocument;
    }

    updateCssPreviewState();
  });

  $effect(() => {
    if (!active) {
      stopPreviewModes();
      isCssEditorFocused = false;
      onVisibilityChange?.(false);
      return;
    }

    updateCssPreviewState();
  });

  $effect(() => {
    if (!isMatchPreviewing) {
      return;
    }
    applyPreviewHighlights();
  });

  $effect(() => {
    if (isMatchPreviewing && active) {
      showHighlightNotice(highlightedPreviewCount);
      return;
    }
    removeHighlightNotice();
  });

  $effect(() => {
    if (!active) {
      return;
    }

    const shouldHidePopupForCssPreview = isCssStylePreviewing && !cssPreviewErrorMessage;
    onVisibilityChange?.(isMatchPreviewing || shouldHidePopupForCssPreview);
  });

  $effect(() => {
    if (!isCssStylePreviewing) {
      return;
    }
    applyCssStylePreview();
  });
</script>

<Tooltip.Provider>
  <div class="flex h-full min-h-0 overflow-hidden">
    <div class="flex flex-col flex-1 min-w-0 p-3 gap-3">
      <div
        class="flex-1 min-h-0 rounded-lg border border-gray-800 bg-gray-950 overflow-hidden"
        role="region"
        aria-label="CSS selector editor"
      >
        <div class="h-full w-full" bind:this={cssEditorHost}></div>
      </div>

      {#if errorMessage}
        <div class="text-xs text-red-400">{errorMessage}</div>
      {/if}

      <div class="flex gap-2">
        <button
          type="button"
          onclick={handleSave}
          class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-accent-500 text-gray-950 hover:bg-accent-400 transition-colors cursor-pointer"
          >Save</button
        >
        <Button
          variant="outline"
          onclick={onCancel}
          class="!rounded-md !border !border-white/20 !px-3 !py-2 !text-gray-500 hover:!bg-white/10 hover:!text-gray-300 dark:!text-gray-400 dark:hover:!text-gray-200"
          aria-label="Close popup"
        >
          x
        </Button>
      </div>
    </div>

    <div class="flex flex-col w-64 max-w-64 min-w-0 border-l border-gray-800 bg-black/20 p-3 gap-3">
      {#if hasNoMatchingElements}
        <div class="flex h-full items-center justify-center text-center text-sm text-gray-400">
          Selector does not match any elements
        </div>
      {:else}
        {#if activeCssPart}
          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs uppercase tracking-wide text-gray-500">{activeCssPart.type}</span>
              <span class="font-mono text-xs text-accent-400 break-all">{activeCssPart.displayText}</span>
            </div>
            <p class="h-14 text-xs leading-5 text-gray-400">{activeCssPart.description}</p>
          </div>
        {:else}
          <div class="h-14 text-xs leading-5 text-gray-500">Place the text caret on a selector part to inspect it.</div>
        {/if}

      <div class="flex items-center justify-between gap-2">
        <div class="text-xs uppercase tracking-wide text-gray-500">Properties</div>
        <input
          type="search"
          bind:value={propertySearchTerm}
          placeholder="Search"
          class="h-6 w-28 rounded border border-white/15 bg-white/5 px-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-white/25 focus:outline-none"
          aria-label="Search CSS inspector properties"
        />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <div class="flex flex-col gap-2">
          {#each filteredPropertyItems as item (item.key)}
            <div class="flex justify-between items-center rounded-md border border-transparent px-2 py-1 hover:bg-white/10">
              <CopyablePropertyText text={item.key} align="left" class="flex-1 min-w-0 text-accent-500" />
              <CopyablePropertyText
                text={item.value}
                displayText={item.value.length > 18 ? `${item.value.length} chars` : truncate(item.value, 30)}
                title={item.value}
                class="max-w-28 text-secondary-500"
              />
            </div>
          {/each}

          {#if filteredPropertyItems.length === 0}
            <div class="text-xs text-gray-500 text-center p-2">No properties available.</div>
          {/if}

          <hr class="my-1 border-gray-800" />

          {#each filteredComputedStyleProperties as property (property.key)}
            {@const currentValue = getDraftValue(property.key, property.value)}
            {@const inputWidthCh = Math.max(5, currentValue.length + 1)}
            <div
              class={`relative flex justify-between items-center gap-2 rounded-md border px-2 py-1 overflow-visible transition-colors ${property.edited ? "border-accent-400/40 bg-accent-500/10" : "border-transparent hover:bg-white/10"}`}
              role="button"
              tabindex="0"
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  focusComputedValueInput(property.key);
                }
              }}
              onclick={() => focusComputedValueInput(property.key)}
            >
              {#if property.edited}
                <button
                  type="button"
                  class="absolute left-1 top-1/2 -translate-y-1/2 inline-flex h-4 w-4 items-center justify-center rounded text-accent-300 hover:bg-accent-400/20"
                  onclick={(event) => {
                    event.stopPropagation();
                    revertComputedValue(property.key);
                  }}
                  aria-label={`Revert ${property.key}`}
                >
                  <RotateCw class="h-3.5 w-3.5 -scale-x-100 text-gray-300 cursor-pointer" strokeWidth={2.75} />
                </button>
              {/if}

              <CopyablePropertyText
                text={property.key}
                align="left"
                class={`flex-1 min-w-0 text-accent-500 ${property.edited ? "pl-5" : ""}`}
                stopPropagation={true}
              />

              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <input
                      {...props}
                      type="text"
                      use:computedValueInput={property.key}
                      value={currentValue}
                      style={`width: ${inputWidthCh}ch;`}
                      class="h-6 shrink-0 rounded border border-transparent bg-transparent px-1 font-mono text-xs text-secondary-500 text-right hover:overflow-visible focus:border-white/20 focus:bg-white/5 focus:outline-none"
                      onclick={(event) => event.stopPropagation()}
                      oninput={(event) => setDraftValue(property.key, event.currentTarget.value)}
                      onblur={() => commitComputedValue(property.key, property.value)}
                      onkeydown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitComputedValue(property.key, property.value);
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          clearDraftValue(property.key);
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label={`Edit ${property.key}`}
                    />
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    sideOffset={6}
                    class="max-w-96 break-all rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-caption text-gray-100 shadow-lg"
                  >
                    {currentValue}
                    <Tooltip.Arrow class="fill-gray-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          {/each}

          {#if filteredComputedStyleProperties.length === 0}
            <div class="text-xs text-gray-500 text-center p-2">No computed styles available.</div>
          {/if}
        </div>
      </div>

        <div class="mt-auto space-y-4">
          {#if hasNthOfTypeRule}
            <p class="text-xs text-gray-500">
              Want to broaden the selector?
              <button
                type="button"
                class="ml-1 cursor-pointer bg-transparent p-0 text-accent-400 underline decoration-accent-400/80 underline-offset-2 transition hover:text-accent-300"
                onclick={removeNthOfTypeFromCssSelector}
              >
                Remove nth-of-type
              </button>
            </p>
          {/if}

          <p class="text-xs text-gray-500">
            Hold <code>z</code> to highlight {formatMatchingElementsLabel(matchingElementCount)
            }{isCssEditorFocused ? " (unfocus code editor first)" : ""}
          </p>
          <p class="text-xs text-gray-500">
            Hold <code>x</code> to preview applied CSS styles{isCssEditorFocused ? " (unfocus code editor first)" : ""}
          </p>

          {#if cssPreviewErrorMessage}
            <p class="text-sm text-red-400">{cssPreviewErrorMessage}</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</Tooltip.Provider>
