<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    createMonacoEditor,
    createMonacoRange,
    type MonacoCodeEditorHandle,
    updateMonacoEditorValue,
  } from "@/lib/code-editor";
  import { readBaseSelectorFromCode, replaceBaseSelectorInCode } from "../base-selector";
  import {
    appendSelectorSnippet,
    buildDroppedFilterInsertText,
    findNearestWordBreak,
  } from "./selector-popup-dnd";
  import log from "@/lib/logger";

  type Props = {
    code: string;
    baseSelector: string;
    fallbackSelector: string;
    onCodeChange: (nextCode: string) => void;
    onBaseSelectorChange?: (nextSelector: string) => void;
    onFocusChange: (focused: boolean) => void;
    errorMessage: string;
    previewErrorMessage: string | null;
    onSave: () => void | Promise<void>;
    onCancel: () => void;
  };

  let {
    code,
    baseSelector,
    fallbackSelector,
    onCodeChange,
    onBaseSelectorChange,
    onFocusChange,
    errorMessage,
    previewErrorMessage,
    onSave,
    onCancel,
  }: Props = $props();

  const logger = log.getLogger("selector-popup");
  let editorHost: HTMLDivElement | null = null;
  let editorHandle: MonacoCodeEditorHandle | null = null;
  let dragCaret: HTMLDivElement | null = null;
  let lastInsertPos: { lineNumber: number; column: number } | null = null;
  let lastSyncedBaseSelector = $state("");
  let destroyed = false;
  let disposeEditorFocus = () => {};
  let disposeEditorBlur = () => {};

  const getCurrentBaseSelector = () => readBaseSelectorFromCode(editorHandle?.editor.getValue() ?? code) ?? fallbackSelector;

  const setBaseSelectorInCode = (nextSelector: string) => {
    const normalizedSelector = nextSelector.trim();
    if (!normalizedSelector) {
      return;
    }

    const currentCode = editorHandle?.editor.getValue() ?? code;
    const nextCode = replaceBaseSelectorInCode(currentCode, normalizedSelector);
    if (!nextCode) {
      logger.debug("Unable to update base selector in selector popup editor.", { normalizedSelector });
      return;
    }

    onCodeChange(nextCode);
    onBaseSelectorChange?.(normalizedSelector);
  };

  const getInsertPosFromCoords = (coords: { x: number; y: number }): { lineNumber: number; column: number } | null => {
    if (!editorHandle) {
      return null;
    }

    const editor = editorHandle.editor;
    const model = editor.getModel();
    if (!model) {
      return null;
    }

    const mouseTarget = editor.getTargetAtClientPoint(coords.x, coords.y);
    const position = mouseTarget?.position ?? editor.getPosition();
    if (!position) {
      return null;
    }

    const lineText = model.getLineContent(position.lineNumber);
    const offset = position.column - 1;
    const insertOffset = findNearestWordBreak(lineText, offset);
    return { lineNumber: position.lineNumber, column: insertOffset + 1 };
  };

  const showDragCaret = (position: { lineNumber: number; column: number }) => {
    if (!editorHandle || !dragCaret) {
      return;
    }

    const editor = editorHandle.editor;
    const editorDom = editor.getDomNode();
    if (!(editorDom instanceof HTMLElement)) {
      return;
    }

    const coords = editor.getScrolledVisiblePosition(position);
    if (!coords) {
      return;
    }

    dragCaret.style.left = `${coords.left}px`;
    dragCaret.style.top = `${coords.top}px`;
    dragCaret.style.height = `${coords.height}px`;
    dragCaret.style.opacity = "1";
  };

  const hideDragCaret = () => {
    if (!dragCaret) {
      return;
    }

    dragCaret.style.opacity = "0";
    lastInsertPos = null;
  };

  const handleEditorDragOver = (event: DragEvent) => {
    if (!event.dataTransfer) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    event.dataTransfer.dropEffect = "copy";

    const insertPos = getInsertPosFromCoords({ x: event.clientX, y: event.clientY });
    if (
      insertPos === null ||
      (lastInsertPos !== null &&
        insertPos.lineNumber === lastInsertPos.lineNumber &&
        insertPos.column === lastInsertPos.column)
    ) {
      return;
    }

    lastInsertPos = insertPos;
    showDragCaret(insertPos);
  };

  const handleEditorDrop = (event: DragEvent) => {
    if (!editorHandle || !event.dataTransfer) {
      return;
    }

    const currentEditor = editorHandle.editor;
    const currentModel = editorHandle.model;

    const selectorSnippet = event.dataTransfer.getData("application/x-pp-selector-snippet");
    if (selectorSnippet) {
      event.preventDefault();
      event.stopImmediatePropagation();
      hideDragCaret();
      setBaseSelectorInCode(appendSelectorSnippet(getCurrentBaseSelector(), selectorSnippet));
      currentEditor.focus();
      return;
    }

    const droppedCode =
      event.dataTransfer.getData("application/x-pp-filter") || event.dataTransfer.getData("text/plain");
    if (!droppedCode) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    hideDragCaret();

    const insertPos = getInsertPosFromCoords({ x: event.clientX, y: event.clientY });
    if (insertPos === null) {
      return;
    }

    const insertOffset = currentModel.getOffsetAt(insertPos);
    const insertText = buildDroppedFilterInsertText(currentModel.getValue(), insertOffset, droppedCode);
    currentEditor.executeEdits("page-proxy-drop", [
      {
        range: createMonacoRange(insertPos.lineNumber, insertPos.column, insertPos.lineNumber, insertPos.column),
        text: insertText,
        forceMoveMarkers: true,
      },
    ]);

    const nextPosition = currentModel.getPositionAt(insertOffset + insertText.length);
    currentEditor.setPosition(nextPosition);
    currentEditor.revealPositionInCenterIfOutsideViewport(nextPosition);
    currentEditor.focus();
  };

  const handleEditorDragLeave = (event: DragEvent) => {
    if (!editorHandle) {
      hideDragCaret();
      return;
    }

    const editorDom = editorHandle.editor.getDomNode();
    if (!(editorDom instanceof HTMLElement) || !(event.relatedTarget instanceof Node)) {
      hideDragCaret();
      return;
    }

    if (!editorDom.contains(event.relatedTarget)) {
      hideDragCaret();
    }
  };

  onMount(() => {
    if (!editorHost) {
      return;
    }

    const nextHandle = createMonacoEditor(editorHost, code, {
      language: "javascript",
      modelUri: "inmemory://page-proxy/selector-popup-editor.js",
      onChange: (nextValue) => {
        onCodeChange(nextValue);

        const nextSelector = readBaseSelectorFromCode(nextValue);
        if (!nextSelector) {
          return;
        }

        const normalizedSelector = nextSelector.trim();
        if (!normalizedSelector || normalizedSelector === baseSelector) {
          return;
        }

        onBaseSelectorChange?.(normalizedSelector);
      },
      editorOptions: {
        bracketPairColorization: { enabled: true },
      },
    });

    if (destroyed) {
      nextHandle.dispose();
      return;
    }

    editorHandle = nextHandle;
    const editorDom = nextHandle.editor.getDomNode();
    if (!(editorDom instanceof HTMLElement)) {
      return;
    }

    editorDom.style.position = "relative";
    dragCaret = document.createElement("div");
    dragCaret.style.position = "absolute";
    dragCaret.style.width = "0.0625rem";
    dragCaret.style.background = "rgb(224 201 135)";
    dragCaret.style.opacity = "0";
    dragCaret.style.pointerEvents = "none";
    editorDom.appendChild(dragCaret);

    editorDom.addEventListener("dragover", handleEditorDragOver, { capture: true });
    editorDom.addEventListener("drop", handleEditorDrop, { capture: true });
    editorDom.addEventListener("dragleave", handleEditorDragLeave, { capture: true });

    const focusDisposable = nextHandle.editor.onDidFocusEditorText(() => {
      onFocusChange(true);
    });
    disposeEditorFocus = () => {
      focusDisposable.dispose();
      disposeEditorFocus = () => {};
    };

    const blurDisposable = nextHandle.editor.onDidBlurEditorText(() => {
      onFocusChange(false);
    });
    disposeEditorBlur = () => {
      blurDisposable.dispose();
      disposeEditorBlur = () => {};
    };

    onFocusChange(nextHandle.editor.hasTextFocus());
  });

  onDestroy(() => {
    destroyed = true;
    onFocusChange(false);
    disposeEditorFocus();
    disposeEditorBlur();

    if (!editorHandle) {
      return;
    }

    const editorDom = editorHandle.editor.getDomNode();
    if (editorDom instanceof HTMLElement) {
      editorDom.removeEventListener("dragover", handleEditorDragOver, { capture: true });
      editorDom.removeEventListener("drop", handleEditorDrop, { capture: true });
      editorDom.removeEventListener("dragleave", handleEditorDragLeave, { capture: true });
    }
    if (dragCaret) {
      dragCaret.remove();
      dragCaret = null;
    }

    editorHandle.dispose();
    editorHandle = null;
  });

  $effect(() => {
    if (!editorHandle) {
      return;
    }

    const currentCode = editorHandle.editor.getValue();
    if (currentCode === code) {
      return;
    }

    updateMonacoEditorValue(editorHandle, code);
  });

  $effect(() => {
    const normalizedSelector = baseSelector.trim();
    if (!lastSyncedBaseSelector) {
      lastSyncedBaseSelector = normalizedSelector;
      return;
    }

    if (!editorHandle || !normalizedSelector || normalizedSelector === lastSyncedBaseSelector) {
      return;
    }

    lastSyncedBaseSelector = normalizedSelector;

    const currentCode = editorHandle.editor.getValue();
    const currentSelector = readBaseSelectorFromCode(currentCode);
    if (currentSelector === normalizedSelector) {
      return;
    }

    const nextCode = replaceBaseSelectorInCode(currentCode, normalizedSelector);
    if (!nextCode) {
      return;
    }

    onCodeChange(nextCode);
  });
</script>

<div class="flex flex-col flex-1 min-w-0 p-3 gap-3">
  <div class="flex-1 min-h-0 rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
    <div class="h-full w-full" bind:this={editorHost}></div>
  </div>

  {#if errorMessage}
    <div class="text-xs text-red-400">{errorMessage}</div>
  {/if}
  {#if previewErrorMessage}
    <div class="text-xs text-amber-300">{previewErrorMessage}</div>
  {/if}

  <div class="flex gap-2">
    <button
      type="button"
      onclick={onSave}
      class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-accent-500 text-gray-950 hover:bg-accent-400 transition-colors cursor-pointer"
    >
      Save
    </button>
    <button
      type="button"
      onclick={onCancel}
      class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-transparent text-gray-100 border border-white/20 hover:bg-white/10 transition-colors cursor-pointer"
    >
      Cancel
    </button>
  </div>
</div>
