<script lang="ts">
  import type { ElementInfo, SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { Tooltip } from "bits-ui";
  import { onMount } from "svelte";
  import { type MonacoCodeEditorHandle, updateMonacoEditorValue } from "@/lib/code-editor";
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
  import { createPreviewManager } from "./css-inspector/preview-manager";
  import { initCssEditor } from "./css-inspector/css-editor-init";
  import CssPropertySidebar from "./css-inspector/CssPropertySidebar.svelte";

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
    info: ElementInfo | null;
    propertyItems: PropertyItem[];
    targetElement: Element | null;
    onSave: (payload: SelectorSavePayload) => Promise<SelectorSaveResult>;
    onCancel: () => void;
    baseSelector: string;
    active?: boolean;
    initialCssContent?: string;
    initialCode?: string;
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
    initialCssContent,
    initialCode,
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
  let highlightedPreviewCount = $state(0);
  let matchingElementCount = $state(0);
  let cssPreviewErrorMessage = $state<string | null>(null);
  let errorMessage = $state("");
  let disposeCssEditor: (() => void) | null = null;

  const previewManager = createPreviewManager({
    getCssEditorValue: () => cssEditorValue,
    getCssEditorHandle: () => cssEditorHandle,
    setIsMatchPreviewing: (v) => {
      isMatchPreviewing = v;
    },
    setIsCssStylePreviewing: (v) => {
      isCssStylePreviewing = v;
    },
    setHighlightedPreviewCount: (v) => {
      highlightedPreviewCount = v;
    },
    setMatchingElementCount: (v) => {
      matchingElementCount = v;
    },
    setCssPreviewErrorMessage: (v) => {
      cssPreviewErrorMessage = v;
    },
    getIsMatchPreviewing: () => isMatchPreviewing,
    getIsCssStylePreviewing: () => isCssStylePreviewing,
  });

  const cssSelectorSource = $derived.by(() => readSelectorSourceFromCssEditor(cssEditorValue));
  const cssSelectorParts = $derived.by(() => parseCssSelectorParts(cssSelectorSource));
  const hasNthOfTypeRule = $derived.by(() =>
    cssSelectorParts.some((part) => part.type === "pseudo" && /^:nth-of-type\(/i.test(part.text)),
  );
  const cssPropertyItems = $derived.by(() =>
    propertyItems.filter((item) => item.key !== "selector" && item.key !== "bbox" && item.key !== "innerText"),
  );
  const baseComputedStyleEntries = $derived.by(() => readComputedStyleEntries(targetElement));
  const cssDeclarationEntries = $derived.by(() =>
    parseCssDeclarations(readDeclarationSourceFromCssEditor(cssEditorValue)),
  );
  const activeCssPart = $derived.by<CssSelectorPart | null>(() => {
    const currentOffset = hoveredCssOffset;
    if (currentOffset === null || currentOffset >= cssSelectorSource.length) return null;
    return cssSelectorParts.find((part) => currentOffset >= part.startOffset && currentOffset < part.endOffset) ?? null;
  });

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
      entries.push({
        key,
        value,
        originalValue,
        edited: declaration !== undefined && value !== originalValue,
        originalOrder: baseOrderByKey.get(key) ?? Number.MAX_SAFE_INTEGER,
        declarationOrder: declaration?.order ?? null,
      });
    });
    entries.sort((left, right) => {
      if (left.edited !== right.edited) return left.edited ? -1 : 1;
      if (left.originalOrder !== right.originalOrder) return left.originalOrder - right.originalOrder;
      const leftOrder = left.declarationOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.declarationOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.key.localeCompare(right.key);
    });
    return entries;
  });

  const updateCssDocumentDeclarations = (nextDeclarationSource: string) => {
    if (!cssEditorHandle) return;
    const currentCssDocument = cssEditorHandle.editor.getValue();
    const selectorValue = normalizeSelectorFromCssEditor(currentCssDocument);
    if (!selectorValue) return;
    const nextCssDocument = buildCssDocument(selectorValue, nextDeclarationSource);
    if (nextCssDocument === currentCssDocument) return;
    updateMonacoEditorValue(cssEditorHandle, nextCssDocument);
    cssEditorValue = nextCssDocument;
  };

  const handleCssComputedPropertyChange = (key: string, value: string) => {
    const declarationSource = readDeclarationSourceFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    updateCssDocumentDeclarations(upsertCssDeclaration(declarationSource, key, value));
  };

  const handleCssComputedPropertyRevert = (key: string) => {
    const declarationSource = readDeclarationSourceFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    updateCssDocumentDeclarations(removeCssDeclaration(declarationSource, key));
  };

  const removeNthOfTypeFromCssSelector = () => {
    if (!cssEditorHandle) return;
    const currentCssDocument = cssEditorHandle.editor.getValue();
    const selectorSource = readSelectorSourceFromCssEditor(currentCssDocument);
    const nthOfTypePattern = /:nth-of-type\(\s*[^)]*\s*\)/gi;
    if (!nthOfTypePattern.test(selectorSource)) return;
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
      { range: fullRange, text: nextCssDocument, forceMoveMarkers: true },
    ]);
    cssEditorHandle.editor.pushUndoStop();
    cssEditorHandle.editor.focus();
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
      originalCode: initialCode?.trim() || initialCssContent?.trim() || undefined,
    };
    const result = await onSave(payload);
    if (!result.ok) {
      errorMessage = result.error;
      return;
    }
    errorMessage = "";
  };

  onMount(() => {
    disposeCssEditor = initCssEditor({
      getHost: () => cssEditorHost,
      getHandle: () => cssEditorHandle,
      setHandle: (v) => {
        cssEditorHandle = v;
      },
      getCssEditorValue: () => cssEditorValue,
      setCssEditorValue: (v) => {
        cssEditorValue = v;
      },
      setHoveredCssOffset: (v) => {
        hoveredCssOffset = v;
      },
      setIsCssEditorFocused: (v) => {
        isCssEditorFocused = v;
      },
      setErrorMessage: (v) => {
        errorMessage = v;
      },
      onBaseSelectorChange,
      applyPreviewHighlights: previewManager.applyPreviewHighlights,
      applyCssStylePreview: previewManager.applyCssStylePreview,
      updateCssPreviewState: previewManager.updateCssPreviewState,
      getIsMatchPreviewing: () => isMatchPreviewing,
      getIsCssStylePreviewing: () => isCssStylePreviewing,
      baseSelector,
      info,
      initialCssContent,
      initialCode,
    });
    const onKeyDown = (e: KeyboardEvent) => previewManager.handleWindowKeyDown(e, active, isCssEditorFocused);
    const onKeyUp = (e: KeyboardEvent) => previewManager.handleWindowKeyUp(e, active);
    const onBlur = () => previewManager.stopAll();
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onBlur, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onBlur, { capture: true });
      previewManager.stopAll();
      previewManager.removeHighlightNotice();
      onVisibilityChange?.(false);
      disposeCssEditor?.();
      if (cssEditorHandle) {
        cssEditorHandle.dispose();
        cssEditorHandle = null;
      }
    };
  });

  $effect(() => {
    if (!cssEditorHandle) return;
    const normalizedBaseSelector = baseSelector.trim();
    if (!normalizedBaseSelector) return;
    const currentCssDocument = cssEditorHandle.editor.getValue();
    const currentSelectorValue = normalizeSelectorFromCssEditor(currentCssDocument);
    if (currentSelectorValue !== normalizedBaseSelector) {
      const declarationValue = readDeclarationSourceFromCssEditor(currentCssDocument);
      const syncedCssDocument = buildCssDocument(normalizedBaseSelector, declarationValue);
      updateMonacoEditorValue(cssEditorHandle, syncedCssDocument);
      cssEditorValue = syncedCssDocument;
    }
    previewManager.updateCssPreviewState();
  });

  $effect(() => {
    if (!active) {
      previewManager.stopAll();
      isCssEditorFocused = false;
      onVisibilityChange?.(false);
      return;
    }
    previewManager.updateCssPreviewState();
  });

  $effect(() => {
    if (!isMatchPreviewing) return;
    previewManager.applyPreviewHighlights();
  });

  $effect(() => {
    if (isMatchPreviewing && active) {
      previewManager.showHighlightNotice(highlightedPreviewCount);
      return;
    }
    previewManager.removeHighlightNotice();
  });

  $effect(() => {
    if (!active) return;
    const shouldHidePopupForCssPreview = isCssStylePreviewing && !cssPreviewErrorMessage;
    onVisibilityChange?.(isMatchPreviewing || shouldHidePopupForCssPreview);
  });

  $effect(() => {
    if (!isCssStylePreviewing) return;
    previewManager.applyCssStylePreview();
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
        <button
          type="button"
          onclick={onCancel}
          class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-transparent text-gray-100 border border-white/20 hover:bg-white/10 transition-colors cursor-pointer"
          >Cancel</button
        >
      </div>
    </div>

    <CssPropertySidebar
      {activeCssPart}
      {cssPropertyItems}
      {cssComputedStyleProperties}
      {cssPreviewErrorMessage}
      {matchingElementCount}
      {hasNthOfTypeRule}
      {isCssEditorFocused}
      onPropertyChange={handleCssComputedPropertyChange}
      onPropertyRevert={handleCssComputedPropertyRevert}
      onRemoveNthOfType={removeNthOfTypeFromCssSelector}
    />
  </div>
</Tooltip.Provider>
