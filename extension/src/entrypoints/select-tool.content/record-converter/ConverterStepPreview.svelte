<script lang="ts">
  import { onDestroy } from "svelte";

  import { createMonacoEditor, type MonacoCodeEditorHandle, updateMonacoEditorValue } from "@/lib/code-editor";
  import type {
    ParentTraversalMode,
    ParentTraversalOption,
    SelectElementMode,
    SelectElementOption,
  } from "./generate";
  import type { SupportedRecordStep } from "./normalize";

  type Props = {
    activeStep: SupportedRecordStep | null;
    parentOption: ParentTraversalOption | null;
    selectOption: SelectElementOption | null;
    stepPreviewCode: string;
    onSelectModeChange: (step: SupportedRecordStep, mode: SelectElementMode) => void;
    onParentModeChange: (step: SupportedRecordStep, mode: ParentTraversalMode) => void;
    onParentCountChange: (step: SupportedRecordStep, nextCount: string) => void;
    onStepPreviewCodeChange: (step: SupportedRecordStep, nextCode: string) => void;
  };

  let {
    activeStep,
    parentOption,
    selectOption,
    stepPreviewCode,
    onSelectModeChange,
    onParentModeChange,
    onParentCountChange,
    onStepPreviewCodeChange,
  }: Props = $props();

  let previewEditorHost = $state<HTMLDivElement | null>(null);
  let previewEditorHandle = $state<MonacoCodeEditorHandle | null>(null);

  const parseStepNumber = (stepId: string) => {
    const parsed = Number.parseInt(stepId.replace("step-", ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const getStepActionName = (kind: SupportedRecordStep["kind"]) => {
    if (kind === "select-element") {
      return "Select element";
    }
    if (kind === "click-element") {
      return "Click element";
    }
    if (kind === "delete-element") {
      return "Delete element";
    }
    if (kind === "cut-element") {
      return "Cut element";
    }
    if (kind === "copy-element") {
      return "Copy element";
    }
    if (kind === "paste-element") {
      return "Paste element";
    }
    if (kind === "apply-style-element") {
      return "Apply style";
    }
    return "Select parent element";
  };

  const getStepDescription = (kind: SupportedRecordStep["kind"]) => {
    if (kind === "select-element") {
      return "Edit the selector so we can find the element you selected during script execution.";
    }
    if (kind === "click-element") {
      return "Review this step before invoking click() on the selected element.";
    }
    if (kind === "delete-element") {
      return "Review this step before removing the currently selected element from the page.";
    }
    if (kind === "cut-element") {
      return "Review this step before removing the selected element and storing its HTML in the clipboard variable.";
    }
    if (kind === "copy-element") {
      return "Review this step before copying the selected element HTML into the clipboard variable.";
    }
    if (kind === "paste-element") {
      return "Review this step before inserting the clipboard HTML after the selected element.";
    }
    if (kind === "apply-style-element") {
      return "Review this step before applying the recorded CSS declarations to the selected element.";
    }
    return "Choose how to traverse to a parent element so we can target the correct container.";
  };

  const stepTitle = $derived.by(() => {
    if (!activeStep) {
      return "";
    }

    return `Step ${parseStepNumber(activeStep.id)}: ${getStepActionName(activeStep.kind)}`;
  });

  const stepDescription = $derived.by(() => {
    if (!activeStep) {
      return "";
    }

    return getStepDescription(activeStep.kind);
  });

  const setupPreviewEditor = async () => {
    if (!previewEditorHost || previewEditorHandle) {
      return;
    }

    previewEditorHandle = await createMonacoEditor(previewEditorHost, stepPreviewCode, {
      language: "javascript",
      modelUri: "file:///page-proxy/record-converter-step-preview.js",
      onChange: (nextValue) => {
        if (!activeStep || nextValue === stepPreviewCode) {
          return;
        }
        onStepPreviewCodeChange(activeStep, nextValue);
      },
      editorOptions: {
        fixedOverflowWidgets: true,
      },
    });
  };

  onDestroy(() => {
    previewEditorHandle?.dispose();
    previewEditorHandle = null;
  });

  $effect(() => {
    if (!previewEditorHost) {
      return;
    }

    void setupPreviewEditor();
  });

  $effect(() => {
    if (!previewEditorHandle) {
      return;
    }

    if (previewEditorHandle.editor.getValue() === stepPreviewCode) {
      return;
    }

    updateMonacoEditorValue(previewEditorHandle, stepPreviewCode);
  });

  $effect(() => {
    if (!previewEditorHandle || !activeStep) {
      return;
    }

    requestAnimationFrame(() => {
      previewEditorHandle?.editor.layout();
      previewEditorHandle?.editor.focus();
    });
  });
</script>

{#if activeStep}
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 border-b border-gray-700 px-4 py-3">
      <h3 class="text-lead">{stepTitle}</h3>
      <p class="mt-1 text-caption text-gray-300">{stepDescription}</p>
      {#if activeStep.kind === "select-element" && selectOption}
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <div class="inline-flex rounded-lg border border-gray-600 bg-gray-900 p-1">
            <button
              type="button"
              class={`rounded-md px-3 py-1 text-caption transition ${
                selectOption.mode === "wait-until-match" ? "bg-gray-700 text-white" : "text-gray-300 hover:text-white"
              }`}
              onclick={() => onSelectModeChange(activeStep, "wait-until-match")}
            >
              Wait until match
            </button>
            <button
              type="button"
              class={`rounded-md px-3 py-1 text-caption transition ${
                selectOption.mode === "on-element-matches" ? "bg-gray-700 text-white" : "text-gray-300 hover:text-white"
              }`}
              onclick={() => onSelectModeChange(activeStep, "on-element-matches")}
            >
              On element matches
            </button>
          </div>
        </div>
      {/if}
      {#if activeStep.kind === "select-parent" && parentOption}
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <div class="inline-flex rounded-lg border border-gray-600 bg-gray-900 p-1">
            <button
              type="button"
              class={`rounded-md px-3 py-1 text-caption transition ${
                parentOption.mode === "traverse-until" ? "bg-gray-700 text-white" : "text-gray-300 hover:text-white"
              }`}
              onclick={() => onParentModeChange(activeStep, "traverse-until")}
            >
              Traverse until
            </button>
            <button
              type="button"
              class={`rounded-md px-3 py-1 text-caption transition ${
                parentOption.mode === "traverse-n-times" ? "bg-gray-700 text-white" : "text-gray-300 hover:text-white"
              }`}
              onclick={() => onParentModeChange(activeStep, "traverse-n-times")}
            >
              Traverse n times
            </button>
            <button
              type="button"
              class={`rounded-md px-3 py-1 text-caption transition ${
                parentOption.mode === "selector-reselect" ? "bg-gray-700 text-white" : "text-gray-300 hover:text-white"
              }`}
              onclick={() => onParentModeChange(activeStep, "selector-reselect")}
            >
              Selector re-select
            </button>
          </div>

          {#if parentOption.mode === "traverse-n-times"}
            <label class="flex items-center gap-2 text-caption text-gray-300">
              <span>n</span>
              <input
                class="w-20 rounded-md border border-gray-600 bg-gray-950 px-3 py-1 text-caption text-white outline-none transition focus:border-accent-500/70"
                type="number"
                min="1"
                value={String(parentOption.count)}
                oninput={(event) => onParentCountChange(activeStep, event.currentTarget.value)}
              />
            </label>
          {/if}
        </div>
      {/if}
    </div>

    <div class="flex min-h-0 flex-1 flex-col p-4">
      <div class="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
        <div class="h-full w-full min-h-0" bind:this={previewEditorHost}></div>
      </div>
    </div>
  </div>
{:else}
  <div class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-950">
    <p class="text-caption text-gray-400">Select a step to review generated code.</p>
  </div>
{/if}
