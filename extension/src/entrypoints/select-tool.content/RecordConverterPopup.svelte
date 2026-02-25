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
    buildGeneratedReviewCode,
    buildStepSnippet,
    type ParentTraversalMode,
    type ParentTraversalOptionsByStepId,
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
  let hasInitializedActiveStep = false;
  let parentOptions = $state<ParentTraversalOptionsByStepId>({});
  let reviewCode = $state("");
  let saveError = $state("");
  let isSaving = $state(false);
  let hasManualReviewEdits = $state(false);

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

  const readonlyStepPreviewCode = $derived.by(() => {
    if (!activeStep) {
      return "";
    }
    return buildStepSnippet(activeStep, parentOptions);
  });
  const activeParentOption = $derived.by(() => {
    if (!activeStep || activeStep.kind !== "select-parent") {
      return null;
    }
    return getParentOption(activeStep);
  });

  const canSave = $derived.by(() => saveValidationMessage.length === 0 && !isSaving);

  const selectStep = (stepId: string) => {
    activeStepId = stepId;
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
          hasManualReviewEdits = true;
          saveError = "";
        }
      },
      editorOptions: {
        bracketPairColorization: { enabled: true },
      },
    });
  };

  const resetReviewToGenerated = () => {
    hasManualReviewEdits = false;
    const generatedCode = generatedReview.finalCode;
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
    reviewCode = generatedReview.finalCode;
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
    if (!hasManualReviewEdits) {
      const generatedCode = generatedReview.finalCode;
      reviewCode = generatedCode;
      if (reviewEditorHandle && reviewEditorHandle.editor.getValue() !== generatedCode) {
        applyingGeneratedReviewCode = true;
        updateMonacoEditorValue(reviewEditorHandle, generatedCode);
        applyingGeneratedReviewCode = false;
      }
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
    requestAnimationFrame(() => {
      reviewEditorHandle?.editor.layout();
      reviewEditorHandle?.editor.focus();
    });
  });
</script>

<div class="pp-no-select-tool fixed inset-0 z-2147483646 flex items-center justify-center bg-black/60 p-4">
  <section
    class="pp-no-select-tool flex h-full w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-white shadow-2xl"
    style="color-scheme: dark;"
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
          <ConverterReviewHeader renameMap={generatedReview.renameMap} onReset={resetReviewToGenerated} />
          <div class="min-h-0 flex-1 p-4">
            <div class="h-full min-h-0 overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
              <div class="h-full w-full min-h-0" bind:this={reviewEditorHost}></div>
            </div>
          </div>
        {:else}
          <ConverterStepPreview
            {activeStep}
            parentOption={activeParentOption}
            {readonlyStepPreviewCode}
            onParentModeChange={updateParentMode}
            onParentUntilSelectorChange={updateParentUntilSelector}
            onParentCountChange={updateParentCount}
          />
        {/if}
      </section>
    </div>
    <ConverterFooter {saveValidationMessage} {saveError} {canSave} {isSaving} {onCancel} onSave={handleSave} />
  </section>
</div>
