<script lang="ts">
  import log from "loglevel";
  import { onDestroy, onMount } from "svelte";
  import { createMonacoEditor, type MonacoCodeEditorHandle, updateMonacoEditorValue } from "@/lib/code-editor";
  import { MONACO_WORKER_ERROR_EVENT } from "@/lib/code-editor/environment";
  import type { RecordConverterOpenPayload, RecordConverterSaveResult } from "@/lib/selection";
  import ConverterFooter from "./record-converter/ConverterFooter.svelte";
  import ConverterReviewHeader from "./record-converter/ConverterReviewHeader.svelte";
  import ConverterStepSidebar from "./record-converter/ConverterStepSidebar.svelte";
  import ConverterStepPreview from "./record-converter/ConverterStepPreview.svelte";
  import ConverterStepsSidebar from "./record-converter/ConverterStepsSidebar.svelte";
  import {
    buildDefaultParentTraversalOption,
    buildGeneratedReviewCode,
    resolveDefaultParentUntilSelector,
    buildStepSnippet,
    type ParentTraversalMode,
    type ParentTraversalOptionsByStepId,
    type ReviewCodeMode,
  } from "./record-converter/generate";
  import {
    normalizeRecordTimeline,
    startsWithSelectedElement,
    type SupportedRecordStep,
  } from "./record-converter/normalize";
  import { generateElementSelectorMatches } from "./popup/selector";
  import { readBaseSelectorFromCode, replaceBaseSelectorInCode } from "./popup/base-selector";
  import { attachPopupKeyboardOwnership, POPUP_SHARED_STYLE } from "./popup/container-shared";
  import {
    createSelectorMatchPreviewController,
    type SelectorMatchPreviewController,
  } from "./popup/selector-preview";

  type Props = {
    payload: RecordConverterOpenPayload;
    onCancel: () => void;
    onSave: (reviewedCode: string) => Promise<RecordConverterSaveResult>;
  };

  let { payload, onCancel, onSave }: Props = $props();
  const logger = log.getLogger("record-popup");
  logger.setLevel("debug", false);

  const normalized = $derived.by(() => normalizeRecordTimeline(payload.timeline));
  const supportedSteps = $derived.by(() => normalized.supportedSteps);
  const skippedEntries = $derived.by(() => normalized.skippedEntries);
  const reviewStepId = "review";
  const defaultParentUntilSelector = $derived.by(() => resolveDefaultParentUntilSelector(supportedSteps));
  const getStepDefaultParentUntilSelector = (step: SupportedRecordStep) => {
    if (step.selectorHint && step.selectorHint.trim().length > 0) {
      return step.selectorHint.trim();
    }
    return defaultParentUntilSelector;
  };

  const getParentOption = (step: SupportedRecordStep) => {
    const option = parentOptions[step.id];
    return option ?? buildDefaultParentTraversalOption(step.count, getStepDefaultParentUntilSelector(step));
  };
  const supportsSelector = (value: string) => {
    if (!value) {
      return false;
    }
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return true;
    }
    return CSS.supports(`selector(${value})`);
  };

  const querySelectableElements = (selector: string) => {
    const normalizedSelector = selector.trim();
    if (!supportsSelector(normalizedSelector)) {
      return [] as Element[];
    }

    return Array.from(document.querySelectorAll(normalizedSelector)).filter(
      (element) => !element.closest(".pp-no-select-tool"),
    );
  };

  let activeStepId = $state(reviewStepId);
  let reviewCodeMode = $state<ReviewCodeMode>("combined");
  let hasInitializedActiveStep = false;
  let parentOptions = $state<ParentTraversalOptionsByStepId>({});
  let reviewCode = $state("");
  let reviewEditorError = $state("");
  let saveError = $state("");
  let isSaving = $state(false);
  let stepPreviewCodeByStepId = $state<Record<string, string>>({});
  let stepPreviewHasLocalEditsByStepId = $state<Record<string, boolean>>({});

  let reviewEditorHost = $state<HTMLDivElement | null>(null);
  let reviewEditorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let popupContainerEl = $state<HTMLElement | null>(null);
  let applyingGeneratedReviewCode = false;
  let releaseKeyboardOwnership = () => {};
  let removeWorkerErrorListener = () => {};
  let selectElementPreviewError = $state<string | null>(null);
  let isSelectElementPreviewing = $state(false);
  let selectElementPreviewController: SelectorMatchPreviewController | null = null;

  const activeStep = $derived.by(() => supportedSteps.find((step) => step.id === activeStepId) ?? null);
  const isReviewStep = $derived.by(() => activeStepId === reviewStepId);
  const chainStartsWithSelectedElement = $derived(startsWithSelectedElement(supportedSteps));

  const saveValidationMessage = $derived.by(() => {
    if (!chainStartsWithSelectedElement) {
      return "Save is disabled because supported steps must start with Selected element.";
    }
    if (supportedSteps.length === 0) {
      return "Save is disabled because there are no supported steps to convert.";
    }
    if (reviewCode.trim().length === 0) {
      return "Save is disabled because review code is empty.";
    }
    return "";
  });

  const generatedReview = $derived.by(() =>
    buildGeneratedReviewCode({
      steps: supportedSteps,
      parentOptions,
      existingCode: payload.existingCode,
      defaultParentUntilSelector,
    }),
  );
  const activeGeneratedReview = $derived.by(() => generatedReview.byMode[reviewCodeMode]);

  const activeStepPreviewCode = $derived.by(() => {
    if (!activeStep) {
      return "";
    }
    return (
      stepPreviewCodeByStepId[activeStep.id] ??
      buildStepSnippet(activeStep, parentOptions, getStepDefaultParentUntilSelector(activeStep))
    );
  });
  const activeParentOption = $derived.by(() => {
    if (!activeStep || activeStep.kind !== "select-parent") {
      return null;
    }
    return getParentOption(activeStep);
  });
  const activeSelectElementBaseSelector = $derived.by(() => {
    if (!activeStep || activeStep.kind !== "select-element") {
      return "";
    }

    const fromCode = readBaseSelectorFromCode(activeStepPreviewCode);
    if (fromCode && fromCode.trim().length > 0) {
      return fromCode.trim();
    }

    return activeStep.selectorHint?.trim() ?? "";
  });
  const activeSelectElementMatchingElements = $derived.by(() => {
    if (!activeStep || activeStep.kind !== "select-element") {
      return [] as Element[];
    }
    return querySelectableElements(activeSelectElementBaseSelector);
  });
  const activeSelectElementSelectorMatches = $derived.by(() => {
    if (!activeStep || activeStep.kind !== "select-element") {
      return [] as string[];
    }

    const targetElement = activeSelectElementMatchingElements[0];
    if (!targetElement) {
      return [] as string[];
    }

    return generateElementSelectorMatches(targetElement, 10);
  });

  const canSave = $derived.by(() => saveValidationMessage.length === 0 && !isSaving);
  const orderedStepIds = $derived.by(() => [...supportedSteps.map((step) => step.id), reviewStepId]);
  const activeStepIndex = $derived.by(() => {
    const index = orderedStepIds.indexOf(activeStepId);
    return index >= 0 ? index : orderedStepIds.length - 1;
  });
  const canGoPrevious = $derived(activeStepIndex > 0);
  const canGoNext = $derived(activeStepIndex >= 0 && activeStepIndex < orderedStepIds.length - 1);

  const selectStep = (stepId: string) => {
    activeStepId = stepId;
  };

  const goToPreviousStep = () => {
    if (!canGoPrevious) {
      return;
    }
    activeStepId = orderedStepIds[activeStepIndex - 1] ?? activeStepId;
  };

  const goToNextStep = () => {
    if (!canGoNext) {
      return;
    }
    activeStepId = orderedStepIds[activeStepIndex + 1] ?? activeStepId;
  };

  const areStringMapsEqual = (left: Record<string, string>, right: Record<string, string>) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every((key) => left[key] === right[key]);
  };

  const areBooleanMapsEqual = (left: Record<string, boolean>, right: Record<string, boolean>) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every((key) => left[key] === right[key]);
  };

  const setupReviewEditor = () => {
    if (!reviewEditorHost || reviewEditorHandle) {
      return;
    }
    logger.debug("creating review editor", {
      codeLength: reviewCode.length,
    });
    reviewEditorError = "";
    try {
      reviewEditorHandle = createMonacoEditor(reviewEditorHost, reviewCode, {
        language: "javascript",
        modelUri: "file:///page-proxy/record-converter-review.js",
        onChange: (nextValue) => {
          reviewCode = nextValue;
          if (!applyingGeneratedReviewCode) {
            saveError = "";
            reviewEditorError = "";
          }
        },
        editorOptions: {
          bracketPairColorization: { enabled: true },
        },
      });
      logger.debug("review editor created");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to initialize the review editor.";
      reviewEditorError = message;
      logger.error("review editor creation failed", { error });
    }
  };

  const resetReviewToGenerated = () => {
    const generatedCode = activeGeneratedReview.finalCode;
    reviewCode = generatedCode;
    if (!reviewEditorHandle) {
      return;
    }
    if (reviewEditorHandle.editor.getValue() === generatedCode) {
      return;
    }

    applyingGeneratedReviewCode = true;
    updateMonacoEditorValue(reviewEditorHandle, generatedCode);
    applyingGeneratedReviewCode = false;
  };

  const updateReviewCodeMode = (nextMode: ReviewCodeMode) => {
    if (reviewCodeMode === nextMode) {
      return;
    }
    reviewCodeMode = nextMode;
    saveError = "";
  };

  const updateParentMode = (step: SupportedRecordStep, mode: ParentTraversalMode) => {
    const currentOption = getParentOption(step);
    parentOptions = {
      ...parentOptions,
      [step.id]: {
        ...currentOption,
        mode,
      },
    };
  };

  const updateParentCount = (step: SupportedRecordStep, nextCount: string) => {
    const parsedValue = Number.parseInt(nextCount, 10);
    const sanitizedCount = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1;
    const currentOption = getParentOption(step);
    parentOptions = {
      ...parentOptions,
      [step.id]: {
        ...currentOption,
        count: sanitizedCount,
      },
    };
  };

  const updateStepPreviewCode = (step: SupportedRecordStep, nextCode: string) => {
    if (stepPreviewCodeByStepId[step.id] !== nextCode) {
      stepPreviewCodeByStepId = {
        ...stepPreviewCodeByStepId,
        [step.id]: nextCode,
      };
    }

    const hasLocalEdit = nextCode !== buildStepSnippet(step, parentOptions, getStepDefaultParentUntilSelector(step));
    if ((stepPreviewHasLocalEditsByStepId[step.id] ?? false) !== hasLocalEdit) {
      stepPreviewHasLocalEditsByStepId = {
        ...stepPreviewHasLocalEditsByStepId,
        [step.id]: hasLocalEdit,
      };
    }
  };

  const applySelectElementSelectorMatch = (nextSelector: string) => {
    if (!activeStep || activeStep.kind !== "select-element") {
      return;
    }

    const nextCode = replaceBaseSelectorInCode(activeStepPreviewCode, nextSelector);
    if (!nextCode) {
      return;
    }

    updateStepPreviewCode(activeStep, nextCode);
    selectElementPreviewError = null;
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    isSaving = true;
    saveError = "";
    try {
      const result = await onSave(reviewCode);
      if (!result.ok) {
        saveError = result.error ?? "Unable to save converted code.";
        logger.error("record popup save failed", {
          error: saveError,
          codeLength: reviewCode.length,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save converted code.";
      saveError = message;
      logger.error("record popup save threw", { error, codeLength: reviewCode.length });
    }
    isSaving = false;
  };

  onMount(() => {
    logger.debug("record popup mounted", {
      timelineSize: payload.timeline.length,
      existingCodeLength: payload.existingCode.length,
    });
    reviewCode = activeGeneratedReview.finalCode;
    setupReviewEditor();
    releaseKeyboardOwnership = attachPopupKeyboardOwnership(popupContainerEl);
    selectElementPreviewController = createSelectorMatchPreviewController({
      getSelectorCode: () => activeStepPreviewCode,
      isEnabled: () => !isReviewStep && activeStep?.kind === "select-element",
      onError: (message) => {
        selectElementPreviewError = message;
      },
      onPreviewStateChange: (previewing) => {
        isSelectElementPreviewing = previewing;
      },
    });
    selectElementPreviewController.mount();

    const onMonacoWorkerError = (event: Event) => {
      const customEvent = event as CustomEvent<{ label?: string; message?: string }>;
      const message = customEvent.detail?.message?.trim() || "Monaco worker failed to start.";
      reviewEditorError = message;
      logger.error("monaco worker error surfaced in record popup", {
        label: customEvent.detail?.label ?? "unknown",
        message,
      });
    };
    globalThis.addEventListener(MONACO_WORKER_ERROR_EVENT, onMonacoWorkerError as EventListener);
    removeWorkerErrorListener = () => {
      globalThis.removeEventListener(MONACO_WORKER_ERROR_EVENT, onMonacoWorkerError as EventListener);
    };
  });

  onDestroy(() => {
    logger.debug("record popup destroyed");
    selectElementPreviewController?.dispose();
    selectElementPreviewController = null;
    removeWorkerErrorListener();
    releaseKeyboardOwnership();
    reviewEditorHandle?.dispose();
    reviewEditorHandle = null;
  });

  $effect(() => {
    const stepList = supportedSteps;
    const nextOptions = { ...parentOptions };
    let hasOptionChanges = false;

    stepList.forEach((step) => {
      if (step.kind !== "select-parent" || nextOptions[step.id]) {
        return;
      }
      nextOptions[step.id] = buildDefaultParentTraversalOption(step.count, getStepDefaultParentUntilSelector(step));
      hasOptionChanges = true;
    });

    if (hasOptionChanges) {
      parentOptions = nextOptions;
    }

    if (activeStepId !== reviewStepId && !stepList.some((step) => step.id === activeStepId)) {
      activeStepId = stepList[0]?.id ?? reviewStepId;
    }

    if (!hasInitializedActiveStep && activeStepId === reviewStepId && stepList.length > 0) {
      activeStepId = stepList[0].id;
      hasInitializedActiveStep = true;
    }
  });

  $effect(() => {
    const nextPreviewCodeByStepId: Record<string, string> = {};
    const nextPreviewHasLocalEditsByStepId: Record<string, boolean> = {};

    supportedSteps.forEach((step) => {
      const generatedCode = buildStepSnippet(step, parentOptions, getStepDefaultParentUntilSelector(step));
      const hasLocalEdit = stepPreviewHasLocalEditsByStepId[step.id] ?? false;
      nextPreviewHasLocalEditsByStepId[step.id] = hasLocalEdit;
      nextPreviewCodeByStepId[step.id] = hasLocalEdit
        ? (stepPreviewCodeByStepId[step.id] ?? generatedCode)
        : generatedCode;
    });

    if (!areStringMapsEqual(stepPreviewCodeByStepId, nextPreviewCodeByStepId)) {
      stepPreviewCodeByStepId = nextPreviewCodeByStepId;
    }

    if (!areBooleanMapsEqual(stepPreviewHasLocalEditsByStepId, nextPreviewHasLocalEditsByStepId)) {
      stepPreviewHasLocalEditsByStepId = nextPreviewHasLocalEditsByStepId;
    }
  });

  $effect(() => {
    if (!isReviewStep && reviewEditorHandle) {
      logger.debug("disposing review editor after leaving review step");
      reviewEditorHandle.dispose();
      reviewEditorHandle = null;
      reviewEditorHost = null;
      return;
    }

    if (isReviewStep && reviewEditorHost && !reviewEditorHandle) {
      setupReviewEditor();
    }
  });

  $effect(() => {
    if (!isReviewStep) {
      return;
    }

    if (!reviewEditorHandle) {
      if (reviewEditorHost) {
        setupReviewEditor();
      }
      if (!reviewEditorHandle) {
        if (!reviewEditorError) {
          reviewEditorError = "Review editor is unavailable.";
          logger.error("review step is active without an editor instance");
        }
      }
      return;
    }

    reviewEditorError = "";
    const generatedCode = activeGeneratedReview.finalCode;
    reviewCode = generatedCode;
    if (reviewEditorHandle.editor.getValue() !== generatedCode) {
      applyingGeneratedReviewCode = true;
      updateMonacoEditorValue(reviewEditorHandle, generatedCode);
      applyingGeneratedReviewCode = false;
    }

    requestAnimationFrame(() => {
      reviewEditorHandle?.editor.layout();
      reviewEditorHandle?.editor.focus();
    });
  });

  $effect(() => {
    const _previewSelectorCode = activeStepPreviewCode;
    selectElementPreviewController?.refresh();
  });

  $effect(() => {
    if (!activeStep || activeStep.kind !== "select-element") {
      selectElementPreviewError = null;
      selectElementPreviewController?.stop();
      return;
    }

    if (!isSelectElementPreviewing) {
      selectElementPreviewError = null;
    }
  });
</script>

<div
  class={`pp-no-select-tool fixed inset-0 z-2147483646 flex items-center justify-center bg-black/60 p-4 ${
    isSelectElementPreviewing ? "invisible" : ""
  }`}
>
  <section
    bind:this={popupContainerEl}
    class="pp-no-select-tool flex w-full h-full max-w-5xl max-h-[40em] min-h-0 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-white shadow-2xl"
    style={POPUP_SHARED_STYLE}
    aria-label="Record converter popup"
  >
    <header class="flex items-center gap-3 border-b border-gray-700 bg-gray-850 px-5 py-3">
      <div class="min-w-0">
        <h2 class="text-lead">Convert to code</h2>
      </div>
      <div class="flex-1"></div>
      <button
        type="button"
        class="rounded-md border border-transparent px-3 py-1 text-caption text-gray-300 transition hover:border-gray-600 hover:text-white"
        onclick={onCancel}
      >
        Close
      </button>
    </header>

    <div class="flex min-h-0 flex-1">
      <ConverterStepsSidebar
        {supportedSteps}
        skippedCount={skippedEntries.length}
        {activeStepId}
        {reviewStepId}
        onStepSelect={selectStep}
      />

      <section class="flex min-h-0 flex-1 flex-col">
        {#if isReviewStep}
          <ConverterReviewHeader
            renameMap={activeGeneratedReview.renameMap}
            mode={reviewCodeMode}
            onModeChange={updateReviewCodeMode}
            onReset={resetReviewToGenerated}
          />
          <div class="flex min-h-0 flex-1 flex-col p-4">
            {#if reviewEditorError}
              <div class="mb-2 rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-caption text-red-300">
                {reviewEditorError}
              </div>
            {/if}
            <div class="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
              <div class="h-full w-full min-h-0" bind:this={reviewEditorHost}></div>
            </div>
          </div>
        {:else}
          <ConverterStepPreview
            {activeStep}
            parentOption={activeParentOption}
            stepPreviewCode={activeStepPreviewCode}
            onParentModeChange={updateParentMode}
            onParentCountChange={updateParentCount}
            onStepPreviewCodeChange={updateStepPreviewCode}
          />
          {#if activeStep?.kind === "select-element"}
            {@const matchCount = activeSelectElementMatchingElements.length}
            <div class="px-4 pb-2 text-caption text-gray-400">
              Hold <code>z</code> to highlight {matchCount} matching element{matchCount === 1 ? "" : "s"}.
            </div>
            {#if selectElementPreviewError}
              <div class="px-4 pb-3 text-caption text-amber-300">{selectElementPreviewError}</div>
            {/if}
          {/if}
        {/if}
      </section>

      <ConverterStepSidebar
        {isReviewStep}
        {activeStep}
        selectElementCurrentSelector={activeSelectElementBaseSelector}
        selectElementSelectorMatches={activeSelectElementSelectorMatches}
        onSelectElementSelectorMatch={applySelectElementSelectorMatch}
      />
    </div>
    <ConverterFooter
      {isReviewStep}
      {canGoPrevious}
      {canGoNext}
      {saveValidationMessage}
      {saveError}
      {canSave}
      {isSaving}
      {onCancel}
      onPrevious={goToPreviousStep}
      onNext={goToNextStep}
      onSave={handleSave}
    />
  </section>
</div>
