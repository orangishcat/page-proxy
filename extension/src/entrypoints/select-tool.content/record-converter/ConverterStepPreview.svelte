<script lang="ts">
  import { onDestroy } from "svelte";

  import { createMonacoEditor, type MonacoCodeEditorHandle, updateMonacoEditorValue } from "@/lib/code-editor";
  import type { ParentTraversalMode, ParentTraversalOption } from "./generate";
  import type { SupportedRecordStep } from "./normalize";

  type Props = {
    activeStep: SupportedRecordStep | null;
    parentOption: ParentTraversalOption | null;
    stepPreviewCode: string;
    onParentModeChange: (step: SupportedRecordStep, mode: ParentTraversalMode) => void;
    onParentUntilSelectorChange: (step: SupportedRecordStep, untilSelector: string) => void;
    onParentCountChange: (step: SupportedRecordStep, nextCount: string) => void;
    onStepPreviewCodeChange: (step: SupportedRecordStep, nextCode: string) => void;
  };

  let {
    activeStep,
    parentOption,
    stepPreviewCode,
    onParentModeChange,
    onParentUntilSelectorChange,
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
    if (kind === "delete-element") {
      return "Delete element";
    }
    return "Select parent element";
  };

  const getStepDescription = (kind: SupportedRecordStep["kind"]) => {
    if (kind === "select-element") {
      return "Edit the selector so we can find the element you selected during script execution.";
    }
    if (kind === "delete-element") {
      return "Review this step before removing the currently selected element from the page.";
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

  const currentSelectedOption = $derived.by(() => {
    if (!activeStep) {
      return "";
    }

    if (activeStep.kind === "select-element") {
      return "Select element";
    }

    if (activeStep.kind === "delete-element") {
      return "Delete element";
    }

    if (!parentOption) {
      return "Select parent element";
    }

    return parentOption.mode === "traverse-until"
      ? `Select parent element: Traverse until (${parentOption.untilSelector || "auto generated selector"})`
      : `Select parent element: Traverse n times (${Math.max(1, Math.floor(parentOption.count))})`;
  });

  const setupPreviewEditor = () => {
    if (!previewEditorHost || previewEditorHandle) {
      return;
    }

    previewEditorHandle = createMonacoEditor(previewEditorHost, stepPreviewCode, {
      modelUri: "inmemory://page-proxy/record-converter-step-preview.js",
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

    setupPreviewEditor();
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
  <div class="border-b border-gray-700 px-4 py-3">
    <h3 class="text-lead">{stepTitle}</h3>
    <p class="mt-1 text-caption text-gray-300">{stepDescription}</p>
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
        </div>

        {#if parentOption.mode === "traverse-until"}
          <label class="flex min-w-0 flex-1 items-center gap-2 text-caption text-gray-300">
            <span>Stop selector</span>
            <input
              class="w-full rounded-md border border-gray-600 bg-gray-950 px-3 py-1 text-caption text-white outline-none transition focus:border-accent-500/70"
              type="text"
              value={parentOption.untilSelector}
              oninput={(event) => onParentUntilSelectorChange(activeStep, event.currentTarget.value)}
            />
          </label>
        {:else}
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

  <div class="p-4">
    <div class="mb-2 text-caption text-gray-300">Current selected option: {currentSelectedOption}</div>
    <div class="h-[30em] overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
      <div class="h-full w-full" bind:this={previewEditorHost}></div>
    </div>
  </div>
{:else}
  <div class="flex h-[30em] items-center justify-center rounded-lg border border-gray-700 bg-gray-950">
    <p class="text-caption text-gray-400">Select a step to review generated code.</p>
  </div>
{/if}
