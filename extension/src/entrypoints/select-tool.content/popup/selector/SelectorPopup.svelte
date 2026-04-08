<script lang="ts">
  import type { PropertyItem } from "@/lib/utils/element-info";
  import type { ElementInfo, SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { Tooltip } from "bits-ui";
  import { onDestroy, onMount } from "svelte";
  import { buildPreviewCode, isSpecialPropertyKey, type FilterOperator } from "./preview-code";
  import { readBaseSelectorFromCode, replaceBaseSelectorInCode } from "../base-selector";
  import { getPqSelectorPreviewState } from "../pq-selector-preview";
  import { buildSelectorTemplateCode } from "../selector";
  import { createSelectorMatchPreviewController, type SelectorMatchPreviewController } from "../selector-preview";
  import SelectorPopupEditorPane from "./SelectorPopupEditorPane.svelte";
  import SelectorPopupPreview from "./SelectorPopupPreview.svelte";
  import SelectorPopupPropertyList from "./SelectorPopupPropertyList.svelte";
  import {
    filterPropertyItems,
    resolveActivePropertyItem,
    resolveActivePropertyKey,
  } from "./selector-popup-properties";
  import log from "@/lib/logger";

  type Props = {
    info: ElementInfo | null;
    propertyItems: PropertyItem[];
    onSave: (payload: SelectorSavePayload) => Promise<SelectorSaveResult>;
    onCancel: () => void;
    baseSelector: string;
    onBaseSelectorChange?: (nextSelector: string) => void;
    active?: boolean;
    onVisibilityChange?: (hidden: boolean) => void;
    initialCode?: string;
  };

  let {
    info,
    propertyItems,
    onSave,
    onCancel,
    baseSelector,
    onBaseSelectorChange,
    active = true,
    onVisibilityChange,
    initialCode,
  }: Props = $props();

  const logger = log.getLogger("selector-popup");

  const resolveInitialEditorValue = () => initialCode?.trim() || buildSelectorTemplateCode(baseSelector.trim() || info?.selector || "body");

  let editorValue = $state("");
  let filterOperator = $state<FilterOperator>("matches");
  let selectedPropertyKey = $state<string | null>(null);
  let propertySearchTerm = $state("");
  let errorMessage = $state("");
  let previewErrorMessage = $state<string | null>(null);
  let selectorMatchCount = $state(0);
  let isSelectorEditorFocused = $state(false);
  let lastSyncedBaseSelector = $state("");
  let selectorPreviewController: SelectorMatchPreviewController | null = null;
  const noMatchesErrorMessages = new Set(["Selector matches no elements.", "Selector does not match any elements"]);

  editorValue = resolveInitialEditorValue();

  const activePropertyKey = $derived.by(() => resolveActivePropertyKey(propertyItems, selectedPropertyKey));
  const activePropertyItem = $derived.by(() => resolveActivePropertyItem(propertyItems, activePropertyKey));
  const filteredPropertyItems = $derived.by(() => filterPropertyItems(propertyItems, propertySearchTerm));
  const filteredSpecialPropertyItems = $derived.by(() => filteredPropertyItems.filteredSpecialPropertyItems);
  const filteredNonSpecialPropertyItems = $derived.by(() => filteredPropertyItems.filteredNonSpecialPropertyItems);

  const isActiveSpecialProperty = $derived.by(() => isSpecialPropertyKey(activePropertyKey));
  const currentBaseSelector = $derived.by(() => readBaseSelectorFromCode(editorValue) ?? info?.selector ?? "body");
  const previewCode = $derived.by(() => buildPreviewCode(activePropertyItem, filterOperator));
  const hasNoMatchingElements = $derived.by(
    () => previewErrorMessage !== null && noMatchesErrorMessages.has(previewErrorMessage),
  );

  const updateSelectorPreviewState = () => {
    const previewState = getPqSelectorPreviewState(editorValue);
    previewErrorMessage = previewState.error;
    selectorMatchCount = previewState.matchingElements.length;
  };

  const setSelectorEditorCode = (nextCode: string) => {
    editorValue = nextCode;
  };

  const handleSave = async () => {
    if (!editorValue.trim()) {
      errorMessage = "Add a selector definition to save.";
      return;
    }
    if (!editorValue.includes("pq.selector")) {
      errorMessage = "Selector definition must include pq.selector.";
      return;
    }

    const payload: SelectorSavePayload = {
      name: null,
      code: editorValue,
      baseSelector: readBaseSelectorFromCode(editorValue) ?? info?.selector ?? "body",
      originalCode: initialCode?.trim() || undefined,
    };

    const result = await onSave(payload);
    if (!result.ok) {
      errorMessage = result.error;
      return;
    }

    errorMessage = "";
  };

  onMount(() => {
    logger.debug("Creating selector popup shell", {
      baseSelector,
      editorValue,
    });
    updateSelectorPreviewState();

    selectorPreviewController = createSelectorMatchPreviewController({
      getSelectorCode: () => editorValue,
      isEnabled: () => active && !isSelectorEditorFocused,
      onError: (message) => {
        previewErrorMessage = message;
      },
      onPreviewStateChange: (previewing) => {
        onVisibilityChange?.(previewing);
      },
    });
    selectorPreviewController.mount();
  });

  onDestroy(() => {
    selectorPreviewController?.dispose();
    selectorPreviewController = null;
    onVisibilityChange?.(false);
  });

  $effect(() => {
    const normalizedSelector = baseSelector.trim();
    if (!lastSyncedBaseSelector) {
      lastSyncedBaseSelector = normalizedSelector;
      return;
    }

    if (!normalizedSelector || normalizedSelector === lastSyncedBaseSelector) {
      return;
    }

    lastSyncedBaseSelector = normalizedSelector;

    const currentSelector = readBaseSelectorFromCode(editorValue);
    if (currentSelector === normalizedSelector) {
      return;
    }

    const nextCode = replaceBaseSelectorInCode(editorValue, normalizedSelector);
    if (!nextCode) {
      return;
    }

    setSelectorEditorCode(nextCode);
  });

  $effect(() => {
    const _previewSelector = currentBaseSelector;
    if (!selectorPreviewController) {
      return;
    }
    selectorPreviewController.refresh();
  });

  $effect(() => {
    const _currentEditorValue = editorValue;
    updateSelectorPreviewState();
  });

  $effect(() => {
    if (active) {
      return;
    }

    previewErrorMessage = null;
    selectorPreviewController?.stop();
    onVisibilityChange?.(false);
  });
</script>

<Tooltip.Provider>
  <div class="flex h-full min-h-0 overflow-hidden">
    <SelectorPopupEditorPane
      code={editorValue}
      baseSelector={baseSelector}
      fallbackSelector={info?.selector ?? "body"}
      onCodeChange={(nextCode) => {
        editorValue = nextCode;
        errorMessage = "";
        updateSelectorPreviewState();
      }}
      {onBaseSelectorChange}
      onFocusChange={(focused) => {
        isSelectorEditorFocused = focused;
      }}
      {errorMessage}
      {previewErrorMessage}
      onSave={handleSave}
      {onCancel}
    />

    <div class="flex flex-col w-64 max-w-64 min-w-0 border-l border-gray-800 bg-black/20 p-3 gap-3">
      {#if !hasNoMatchingElements}
        <SelectorPopupPreview code={previewCode} />
      {/if}
      <SelectorPopupPropertyList
        {hasNoMatchingElements}
        {isActiveSpecialProperty}
        {filterOperator}
        onFilterOperatorChange={(nextFilterOperator) => {
          filterOperator = nextFilterOperator;
        }}
        {propertySearchTerm}
        onPropertySearchTermChange={(nextPropertySearchTerm) => {
          propertySearchTerm = nextPropertySearchTerm;
        }}
        {activePropertyKey}
        {filteredSpecialPropertyItems}
        {filteredNonSpecialPropertyItems}
        onSelectPropertyKey={(nextPropertyKey) => {
          selectedPropertyKey = nextPropertyKey;
        }}
        {selectorMatchCount}
        {isSelectorEditorFocused}
      />
    </div>
  </div>
</Tooltip.Provider>
