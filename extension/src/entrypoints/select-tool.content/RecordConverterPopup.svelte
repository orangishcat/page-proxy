<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { createMonacoEditor, type MonacoCodeEditorHandle, updateMonacoEditorValue } from "@/lib/code-editor";
  import type { RecordConverterOpenPayload, RecordConverterSaveResult } from "@/lib/selection";
  import ConverterFooter from "./record-converter/ConverterFooter.svelte";
  import ConverterReviewHeader from "./record-converter/ConverterReviewHeader.svelte";
  import ConverterStepPreview from "./record-converter/ConverterStepPreview.svelte";
  import ConverterStepsSidebar from "./record-converter/ConverterStepsSidebar.svelte";
  import {
    buildDefaultParentTraversalOption,
    describeStepOption,
    buildGeneratedReviewCode,
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

  type Props = {
    payload: RecordConverterOpenPayload;
    onCancel: () => void;
    onSave: (reviewedCode: string) => Promise<RecordConverterSaveResult>;
  };

  let { payload, onCancel, onSave }: Props = $props();
  const normalized = $derived.by(() => normalizeRecordTimeline(payload.timeline));
  const supportedSteps = $derived.by(() => normalized.supportedSteps);
  const skippedEntries = $derived.by(() => normalized.skippedEntries);
  const reviewStepId = "review";

  const getParentOption = (step: SupportedRecordStep) => {
    const option = parentOptions[step.id];
    return option ?? buildDefaultParentTraversalOption(step.count);
  };

  let activeStepId = $state(reviewStepId);
  let reviewCodeMode = $state<ReviewCodeMode>("combined");
  let hasInitializedActiveStep = false;
  let parentOptions = $state<ParentTraversalOptionsByStepId>({});
  let reviewCode = $state("");
  let saveError = $state("");
  let isSaving = $state(false);
  let stepPreviewCodeByStepId = $state<Record<string, string>>({});
  let stepPreviewHasLocalEditsByStepId = $state<Record<string, boolean>>({});

  let reviewEditorHost = $state<HTMLDivElement | null>(null);
  let reviewEditorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let applyingGeneratedReviewCode = false;

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
    }),
  );
  const activeGeneratedReview = $derived.by(() => generatedReview.byMode[reviewCodeMode]);

  const activeStepPreviewCode = $derived.by(() => {
    if (!activeStep) {
      return "";
    }
    return stepPreviewCodeByStepId[activeStep.id] ?? buildStepSnippet(activeStep, parentOptions);
  });
  const activeParentOption = $derived.by(() => {
    if (!activeStep || activeStep.kind !== "select-parent") {
      return null;
    }
    return getParentOption(activeStep);
  });

  const canSave = $derived.by(() => saveValidationMessage.length === 0 && !isSaving);
  const selectedOptionsSummary = $derived.by(() =>
    supportedSteps.map((step) => describeStepOption(step, parentOptions)).join(" | "),
  );
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
    reviewEditorHandle = createMonacoEditor(reviewEditorHost, reviewCode, {
      modelUri: "inmemory://page-proxy/record-converter-review.js",
      onChange: (nextValue) => {
        reviewCode = nextValue;
        if (!applyingGeneratedReviewCode) {
          saveError = "";
        }
      },
      editorOptions: {
        bracketPairColorization: { enabled: true },
      },
    });
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

  const updateParentUntilSelector = (step: SupportedRecordStep, untilSelector: string) => {
    const currentOption = getParentOption(step);
    parentOptions = {
      ...parentOptions,
      [step.id]: {
        ...currentOption,
        untilSelector,
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

    const hasLocalEdit = nextCode !== buildStepSnippet(step, parentOptions);
    if ((stepPreviewHasLocalEditsByStepId[step.id] ?? false) !== hasLocalEdit) {
      stepPreviewHasLocalEditsByStepId = {
        ...stepPreviewHasLocalEditsByStepId,
        [step.id]: hasLocalEdit,
      };
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    isSaving = true;
    saveError = "";
    const result = await onSave(reviewCode);
    if (!result.ok) {
      saveError = result.error ?? "Unable to save converted code.";
    }
    isSaving = false;
  };

  onMount(() => {
    reviewCode = activeGeneratedReview.finalCode;
    setupReviewEditor();
  });

  onDestroy(() => {
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
      nextOptions[step.id] = buildDefaultParentTraversalOption(step.count);
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
      const generatedCode = buildStepSnippet(step, parentOptions);
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
    if (!reviewEditorHost) {
      return;
    }
    setupReviewEditor();
  });

  $effect(() => {
    if (!isReviewStep || !reviewEditorHandle) {
      return;
    }

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
</script>

<div class="pp-no-select-tool fixed inset-0 z-2147483646 flex items-center justify-center bg-black/60 p-4">
  <section
    class="pp-no-select-tool flex w-full max-w-7xl min-h-0 max-h-[56em] flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-white shadow-2xl"
    style="color-scheme: dark; font-size: 16px !important; --spacing: 0.25em; --text-xs: 0.75em; --text-sm: 0.875em; --text-base: 1em; --text-lg: 1.25em; --radius-sm: 0.25em; --radius-md: 0.375em; --radius-lg: 0.5em; --radius-xl: 0.75em; --radius-2xl: 1em; --radius-3xl: 1.5em;"
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

    <div class="flex min-h-0">
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
          <div class="p-4">
            <div class="mb-2 text-caption text-gray-300">
              Current selected option(s): {selectedOptionsSummary || "none"}
            </div>
            <div class="h-[34em] overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
              <div class="h-full w-full min-h-0" bind:this={reviewEditorHost}></div>
            </div>
          </div>
        {:else}
          <ConverterStepPreview
            {activeStep}
            parentOption={activeParentOption}
            stepPreviewCode={activeStepPreviewCode}
            onParentModeChange={updateParentMode}
            onParentUntilSelectorChange={updateParentUntilSelector}
            onParentCountChange={updateParentCount}
            onStepPreviewCodeChange={updateStepPreviewCode}
          />
        {/if}
      </section>
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
