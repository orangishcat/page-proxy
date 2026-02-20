<script lang="ts">
  import type { ElementInfo, SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { Tooltip } from "bits-ui";
  import { onDestroy, onMount } from "svelte";
  import {
    createMonacoEditor,
    MonacoRange,
    type MonacoCodeEditorHandle,
    updateMonacoEditorValue,
  } from "@/lib/code-editor";
  import { GripVertical } from "lucide-svelte";
  import { buildPreviewCode, isSpecialPropertyKey, type FilterOperator } from "./preview-code";
  import {
    appendSnippetToSelector,
    parseCssSelectorParts,
    type CssSelectorPart,
  } from "./css-inspector";

  type PropertyItem = {
    key: string;
    label: string;
    value: string;
    rawValue: string | ElementInfo["boundingBox"];
    primary: boolean;
  };

  type Props = {
    info: ElementInfo;
    propertyItems: PropertyItem[];
    onSave: (payload: SelectorSavePayload) => Promise<SelectorSaveResult>;
    onCancel: () => void;
  };

  let { info, propertyItems, onSave, onCancel }: Props = $props();

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let editorValue = $state("");
  let dragCaret: HTMLDivElement | null = null;
  let lastInsertPos: { lineNumber: number; column: number } | null = null;
  let cssEditorHost = $state<HTMLDivElement | null>(null);
  let cssEditorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let cssEditorValue = $state("");
  let hoveredCssOffset = $state<number | null>(null);
  let isAltHighlighting = $state(false);
  let highlightedPreviewElements: Element[] = [];
  let disposeCssCursorChange: (() => void) | null = null;

  let previewHost = $state<HTMLDivElement | null>(null);
  let previewHandle = $state<MonacoCodeEditorHandle | null>(null);
  let previewValue = $state("");

  let filterOperator = $state<FilterOperator>("matches");
  let selectedPropertyKey = $state<string | null>(null);
  let errorMessage = $state("");
  type PopupMode = "pp-api" | "css";
  let popupMode = $state<PopupMode>("pp-api");
  const hoveredPreviewClass = "pp-hovered";

  const transparentDragImage = new Image();
  transparentDragImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  const baseSelectorPattern = /(["']baseSelector["']\s*:\s*)(["'`])((?:\\.|(?!\2)[\s\S])*?)\2/;

  const decodeStringLiteral = (value: string) => {
    return value.replace(/\\([\\'"`nrt])/g, (_match, token: string) => {
      if (token === "n") {
        return "\n";
      }
      if (token === "r") {
        return "\r";
      }
      if (token === "t") {
        return "\t";
      }
      return token;
    });
  };

  const escapeForQuote = (value: string, quote: string) => {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replaceAll(quote, `\\${quote}`);
  };

  const readBaseSelectorFromCode = (code: string): string | null => {
    const match = code.match(baseSelectorPattern);
    if (!match) {
      return null;
    }

    return decodeStringLiteral(match[3]);
  };

  const readSelectorSourceFromCssEditor = (value: string) => {
    const braceIndex = value.indexOf("{");
    if (braceIndex < 0) {
      return value;
    }
    return value.slice(0, braceIndex);
  };

  const readTrimmedSelectorSourceFromCssEditor = (value: string) => readSelectorSourceFromCssEditor(value).trim();

  const readDeclarationSourceFromCssEditor = (value: string) => {
    const startBrace = value.indexOf("{");
    if (startBrace < 0) {
      return "";
    }
    const endBrace = value.lastIndexOf("}");
    const end = endBrace > startBrace ? endBrace : value.length;
    return value.slice(startBrace + 1, end).trim();
  };

  const formatSelectorPartsMultiline = (selector: string) => {
    const parts = parseCssSelectorParts(selector);
    if (parts.length === 0) {
      return "";
    }

    const lines: string[] = [];
    let pendingCombinator = "";

    parts.forEach((part) => {
      if (part.type === "descendant") {
        return;
      }
      if (part.type === "group") {
        lines.push(",");
        pendingCombinator = "";
        return;
      }
      if (part.type === "combinator") {
        pendingCombinator = part.text;
        return;
      }

      if (pendingCombinator.length > 0) {
        lines.push(`${pendingCombinator} ${part.text}`);
        pendingCombinator = "";
        return;
      }

      lines.push(part.text);
    });

    return lines.join("\n");
  };

  const normalizeSelectorFromCssEditor = (value: string) => {
    const selectorSource = readTrimmedSelectorSourceFromCssEditor(value);
    const parts = parseCssSelectorParts(selectorSource);
    if (parts.length === 0) {
      return "";
    }

    let result = "";
    let sawWhitespace = false;

    parts.forEach((part) => {
      if (part.type === "descendant") {
        sawWhitespace = true;
        return;
      }
      if (part.type === "group") {
        result = `${result.trimEnd()}, `;
        sawWhitespace = false;
        return;
      }
      if (part.type === "combinator") {
        result = `${result.trimEnd()} ${part.text} `;
        sawWhitespace = false;
        return;
      }

      if (result.length === 0) {
        result = part.text;
        sawWhitespace = false;
        return;
      }

      const attachesDirectly =
        part.type === "class" || part.type === "id" || part.type === "attribute" || part.type === "pseudo";
      const trimmedResult = result.trimEnd();
      const lastChar = trimmedResult[trimmedResult.length - 1] ?? "";
      const isAfterCombinator = lastChar === ">" || lastChar === "+" || lastChar === "~" || lastChar === ",";

      if (attachesDirectly && !isAfterCombinator) {
        result = `${trimmedResult}${part.text}`;
      } else if (sawWhitespace && !isAfterCombinator) {
        result = `${trimmedResult} ${part.text}`;
      } else if (isAfterCombinator) {
        result = `${trimmedResult} ${part.text}`;
      } else {
        result = `${trimmedResult} ${part.text}`;
      }

      sawWhitespace = false;
    });

    return result.trim();
  };

  const buildCssDocument = (selector: string, declarations: string) => {
    const formattedSelector = formatSelectorPartsMultiline(selector);
    const selectorSection = formattedSelector.length > 0 ? formattedSelector : selector.trim();
    const declarationLines = declarations
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    const declarationSection =
      declarationLines.length > 0 ? declarationLines.map((line) => `  ${line}`).join("\n") : "  ";

    return `${selectorSection}\n{\n${declarationSection}\n}`;
  };

  const buildInjectCssSnippet = (selector: string, declarations: string) => {
    const cssDocument = buildCssDocument(selector, declarations);
    return `ps.injectCSS(\`\n${cssDocument}\n\`);`;
  };

  const replaceBaseSelectorInCode = (code: string, nextSelector: string): string | null => {
    if (!baseSelectorPattern.test(code)) {
      return null;
    }

    return code.replace(baseSelectorPattern, (_match, prefix: string, quote: string) => {
      return `${prefix}${quote}${escapeForQuote(nextSelector, quote)}${quote}`;
    });
  };

  const buildDefaultCode = () => {
    return [
      `const Style_1 = pq.selector({`,
      `  ${JSON.stringify("name")}: ${JSON.stringify("Style 1")},`,
      `  ${JSON.stringify("baseSelector")}: ${JSON.stringify(info.selector)},`,
      `  ${JSON.stringify("matches")}: e => true,`,
      "});",
    ].join("\n");
  };

  const activePropertyKey = $derived.by(() => {
    if (selectedPropertyKey && propertyItems.some((item) => item.key === selectedPropertyKey)) {
      return selectedPropertyKey;
    }
    return propertyItems[0]?.key ?? null;
  });

  const activePropertyItem = $derived.by(() => {
    const key = activePropertyKey;
    if (!key) {
      return null;
    }
    return propertyItems.find((property) => property.key === key) ?? null;
  });

  const specialPropertyItems = $derived.by(() => propertyItems.filter((item) => isSpecialPropertyKey(item.key)));

  const nonSpecialPropertyItems = $derived.by(() => propertyItems.filter((item) => !isSpecialPropertyKey(item.key)));

  const isActiveSpecialProperty = $derived.by(() => isSpecialPropertyKey(activePropertyKey));

  const currentBaseSelector = $derived.by(() => {
    return readBaseSelectorFromCode(editorValue) ?? info.selector;
  });

  const cssSelectorSource = $derived.by(() => readSelectorSourceFromCssEditor(cssEditorValue));

  const activeCssSelector = $derived.by(() => {
    return popupMode === "css" ? cssSelectorSource : currentBaseSelector;
  });

  const cssSelectorParts = $derived.by(() => parseCssSelectorParts(activeCssSelector));

  const activeCssPart = $derived.by<CssSelectorPart | null>(() => {
    const currentOffset = hoveredCssOffset;
    if (currentOffset === null) {
      return null;
    }
    if (popupMode === "css" && currentOffset >= cssSelectorSource.length) {
      return null;
    }

    return (
      cssSelectorParts.find(
        (part) => currentOffset >= part.startOffset && currentOffset < part.endOffset,
      ) ?? null
    );
  });

  const previewCode = $derived.by(() => buildPreviewCode(activePropertyItem, filterOperator));

  const setSelectorEditorCode = (nextCode: string) => {
    editorValue = nextCode;
    if (editorHandle) {
      const currentEditorCode = editorHandle.editor.getValue();
      if (currentEditorCode !== nextCode) {
        updateMonacoEditorValue(editorHandle, nextCode);
      }
    }
  };

  const switchPopupMode = (nextMode: PopupMode) => {
    if (popupMode === "css" && nextMode === "pp-api") {
      const selectorOnlyValue = normalizeSelectorFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
      if (selectorOnlyValue.length > 0) {
        const currentCode = editorHandle?.editor.getValue() ?? editorValue;
        const nextCode = replaceBaseSelectorInCode(currentCode, selectorOnlyValue);
        if (nextCode) {
          setSelectorEditorCode(nextCode);
          errorMessage = "";
        }
      }
    }
    popupMode = nextMode;
  };

  const setBaseSelectorInCode = (nextSelector: string) => {
    const currentCode = editorHandle?.editor.getValue() ?? editorValue;
    const nextCode = replaceBaseSelectorInCode(currentCode, nextSelector);

    if (!nextCode) {
      errorMessage = "Unable to update baseSelector from CSS inspector.";
      return false;
    }

    setSelectorEditorCode(nextCode);
    errorMessage = "";
    return true;
  };

  const applyCssSnippetToBaseSelector = (snippet: string) => {
    const currentCssDocument = cssEditorHandle?.editor.getValue() ?? cssEditorValue;
    const currentSelector = normalizeSelectorFromCssEditor(currentCssDocument) || currentBaseSelector;
    const nextSelector = appendSnippetToSelector(currentSelector, snippet);
    if (!setBaseSelectorInCode(nextSelector)) {
      return;
    }

    const declarationValue = readDeclarationSourceFromCssEditor(currentCssDocument);
    const nextCssDocument = buildCssDocument(nextSelector, declarationValue);
    cssEditorValue = nextCssDocument;
    if (cssEditorHandle && cssEditorHandle.editor.getValue() !== nextCssDocument) {
      updateMonacoEditorValue(cssEditorHandle, nextCssDocument);
    }
  };

  const handleCssSave = () => {
    const currentCssDocument = cssEditorHandle?.editor.getValue() ?? cssEditorValue;
    const selectorValue = normalizeSelectorFromCssEditor(currentCssDocument);
    if (selectorValue.length === 0) {
      errorMessage = "Add a valid CSS selector before saving.";
      return;
    }

    const declarationValue = readDeclarationSourceFromCssEditor(currentCssDocument);
    const currentCode = editorHandle?.editor.getValue() ?? editorValue;
    const codeWithSelector = replaceBaseSelectorInCode(currentCode, selectorValue) ?? currentCode;
    const injectSnippet = buildInjectCssSnippet(selectorValue, declarationValue);
    const nextCode = `${codeWithSelector.trimEnd()}\n\n${injectSnippet}\n`;
    setSelectorEditorCode(nextCode);

    const nextCssDocument = buildCssDocument(selectorValue, declarationValue);
    cssEditorValue = nextCssDocument;
    if (cssEditorHandle && cssEditorHandle.editor.getValue() !== nextCssDocument) {
      updateMonacoEditorValue(cssEditorHandle, nextCssDocument);
    }

    errorMessage = "";
    switchPopupMode("pp-api");
  };

  const clearPreviewHighlights = () => {
    highlightedPreviewElements.forEach((element) => {
      element.classList.remove(hoveredPreviewClass);
    });
    highlightedPreviewElements = [];
  };

  const isValidSelectorForPreview = (selector: string) => {
    if (!selector.trim()) {
      return false;
    }
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return true;
    }
    return CSS.supports(`selector(${selector})`);
  };

  const applyPreviewHighlights = () => {
    clearPreviewHighlights();
    if (popupMode !== "css") {
      return;
    }

    const selector = normalizeSelectorFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    if (!isValidSelectorForPreview(selector)) {
      return;
    }

    highlightedPreviewElements = Array.from(document.querySelectorAll(selector)).filter(
      (element) => !element.closest(".pp-no-select-tool"),
    );
    highlightedPreviewElements.forEach((element) => {
      element.classList.add(hoveredPreviewClass);
    });
  };

  const stopAltPreview = () => {
    if (!isAltHighlighting) {
      return;
    }
    isAltHighlighting = false;
    clearPreviewHighlights();
  };

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (!event.altKey || popupMode !== "css") {
      return;
    }
    if (isAltHighlighting) {
      return;
    }
    isAltHighlighting = true;
    applyPreviewHighlights();
  };

  const handleWindowKeyUp = (event: KeyboardEvent) => {
    if (!event.altKey) {
      stopAltPreview();
    }
  };

  const handleWindowBlur = () => {
    stopAltPreview();
  };

  const setupEditor = () => {
    if (!editorHost || editorHandle) {
      return;
    }

    editorValue = buildDefaultCode();

    editorHandle = createMonacoEditor(editorHost, editorValue, {
      modelUri: "inmemory://page-proxy/selector-popup-editor.js",
      onChange: (nextValue) => {
        editorValue = nextValue;
        errorMessage = "";
      },
      editorOptions: {
        bracketPairColorization: { enabled: true },
      },
    });

    const editorDom = editorHandle.editor.getDomNode();
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
  };

  const setupCssEditor = () => {
    if (!cssEditorHost || cssEditorHandle) {
      return;
    }

    const initialDeclarationValue = readDeclarationSourceFromCssEditor(cssEditorValue);
    const initialCssEditorValue =
      cssEditorValue.trim().length > 0
        ? cssEditorValue
        : buildCssDocument(currentBaseSelector, initialDeclarationValue);

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
          return;
        }
        if (!setBaseSelectorInCode(normalizedSelectorValue)) {
          return;
        }
        if (isAltHighlighting) {
          applyPreviewHighlights();
        }
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
  };

  const setupPreview = () => {
    if (!previewHost || previewHandle) {
      return;
    }

    previewHandle = createMonacoEditor(previewHost, previewCode, {
      lineNumbers: "off",
      modelUri: "inmemory://page-proxy/selector-popup-preview.js",
      className: "pp-monaco-editor pp-monaco-preview scrollbar-stable",
      padding: { top: 4, bottom: 4 },
      editorOptions: {
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        overviewRulerLanes: 0,
        renderLineHighlight: "none",
        scrollBeyondLastLine: false,
        fixedOverflowWidgets: true,
      },
    });
    previewValue = previewCode;
  };

  const handleSave = async () => {
    const code = editorHandle?.editor.getValue() ?? editorValue;
    if (!code.trim()) {
      errorMessage = "Add a selector definition to save.";
      return;
    }
    if (!code.includes("pq.selector")) {
      errorMessage = `Selector definition must include pq.selector.`;
      return;
    }

    const payload: SelectorSavePayload = {
      name: null,
      code,
      baseSelector: readBaseSelectorFromCode(code) ?? info.selector,
    };

    const result = await onSave(payload);
    if (!result.ok) {
      errorMessage = result.error;
      return;
    }

    errorMessage = "";
  };

  const handlePreviewDragStart = (event: DragEvent) => {
    if (!event.dataTransfer) {
      return;
    }
    const code = previewHandle?.editor.getValue() ?? previewValue ?? previewCode;

    if (popupMode === "css") {
      event.dataTransfer.setData("application/x-pp-css-selector", code);
      event.dataTransfer.setData("text/plain", code);
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
      return;
    }

    event.dataTransfer.setData("application/x-pp-filter", code);
    event.dataTransfer.setData("text/plain", code);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
  };

  const findNearestWordBreak = (text: string, offset: number) => {
    const breakChars = new Set([".", ",", " "]);
    const candidates = [0, text.length];

    for (let i = 0; i < text.length; i += 1) {
      if (breakChars.has(text[i])) {
        candidates.push(i, i + 1);
      }
    }

    let best = candidates[0] ?? 0;
    let bestDistance = Math.abs(offset - best);

    for (const candidate of candidates) {
      const distance = Math.abs(offset - candidate);
      if (distance < bestDistance || (distance === bestDistance && candidate > best)) {
        best = candidate;
        bestDistance = distance;
      }
    }

    return best;
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
    const cssSnippet = event.dataTransfer.getData("application/x-pp-css-selector");

    if (cssSnippet) {
      event.preventDefault();
      event.stopImmediatePropagation();
      hideDragCaret();
      applyCssSnippetToBaseSelector(cssSnippet);
      currentEditor.focus();
      return;
    }

    const code = event.dataTransfer.getData("application/x-pp-filter") || event.dataTransfer.getData("text/plain");

    if (!code) {
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

    const shouldPrefixAnd = () => {
      const doc = currentModel.getValue();
      let nextIndex = insertOffset;

      while (nextIndex < doc.length && /\s/.test(doc[nextIndex])) {
        nextIndex += 1;
      }

      if (doc[nextIndex] === "=" && doc[nextIndex + 1] === ">") {
        return false;
      }

      let index = insertOffset - 1;

      while (index >= 0 && /\s/.test(doc[index])) {
        index -= 1;
      }

      if (index < 0) {
        return false;
      }

      const previous = doc[index];
      const secondPrevious = index > 0 ? doc[index - 1] : "";
      const isLogicalAnd = secondPrevious === "&" && previous === "&";
      const isLogicalOr = secondPrevious === "|" && previous === "|";
      return !isLogicalAnd && !isLogicalOr;
    };

    const getMatchesIndent = () => {
      const doc = currentModel.getValue();
      const matchLine = doc.match(/^(\s*)["']matches["']\s*:/m);
      return matchLine?.[1] ?? "";
    };

    const getExpressionIndent = () => `${getMatchesIndent()}  `;

    const insertText = shouldPrefixAnd() ? `\n${getExpressionIndent()}&& ${code}` : code;
    currentEditor.executeEdits("page-proxy-drop", [
      {
        range: new MonacoRange(insertPos.lineNumber, insertPos.column, insertPos.lineNumber, insertPos.column),
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

  const truncate = (val: string, max: number) => (val.length > max ? `${val.slice(0, max)}…` : val);

  onMount(() => {
    setupEditor();
    setupPreview();
    window.addEventListener("keydown", handleWindowKeyDown, { capture: true });
    window.addEventListener("keyup", handleWindowKeyUp, { capture: true });
    window.addEventListener("blur", handleWindowBlur, { capture: true });
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleWindowKeyDown, { capture: true });
    window.removeEventListener("keyup", handleWindowKeyUp, { capture: true });
    window.removeEventListener("blur", handleWindowBlur, { capture: true });
    clearPreviewHighlights();

    if (editorHandle) {
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
    }
    if (previewHandle) {
      previewHandle.dispose();
      previewHandle = null;
    }
    if (disposeCssCursorChange) {
      disposeCssCursorChange();
    }
    if (cssEditorHandle) {
      cssEditorHandle.dispose();
      cssEditorHandle = null;
    }
  });

  $effect(() => {
    if (!previewHandle) {
      return;
    }
    const currentValue = previewHandle.editor.getValue();
    if (previewCode === currentValue) {
      return;
    }
    updateMonacoEditorValue(previewHandle, previewCode);
    previewValue = previewCode;
  });

  $effect(() => {
    if (popupMode !== "css") {
      stopAltPreview();
      return;
    }

    setupCssEditor();
    if (!cssEditorHandle) {
      return;
    }

    const currentCssDocument = cssEditorHandle.editor.getValue();
    const currentSelectorValue = normalizeSelectorFromCssEditor(currentCssDocument);
    if (currentSelectorValue !== currentBaseSelector) {
      const declarationValue = readDeclarationSourceFromCssEditor(currentCssDocument);
      const syncedCssDocument = buildCssDocument(currentBaseSelector, declarationValue);
      updateMonacoEditorValue(cssEditorHandle, syncedCssDocument);
      cssEditorValue = syncedCssDocument;
    }
  });

  $effect(() => {
    if (!isAltHighlighting) {
      return;
    }
    applyPreviewHighlights();
  });
</script>

<div
  class="flex flex-col w-full h-full overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-gray-100 font-sans text-sm shadow-2xl pp-content-ui-root"
  style={`color-scheme: dark; visibility: ${isAltHighlighting ? "hidden" : "visible"}; ${popupMode === "css" ? "font-size: 16px !important;" : ""}`}
>
  <Tooltip.Provider>
    <!-- Header -->
    <div class="flex items-center h-12 px-4 gap-2.5 bg-gray-900 border-b border-gray-800">
      <span class="text-lead">{popupMode === "pp-api" ? "Selector editor" : "CSS inspector"}</span>
      {#if popupMode === "pp-api"}
        <a
          href="https://orangishcat.github.io/page-proxy/docs/pp/pq-query#pqselectordefinition"
          target="_blank"
          rel="noopener noreferrer"
          class="text-caption text-accent-400 hover:text-accent-300 hover:underline">Selector documentation</a
        >
      {:else}
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors"
          target="_blank"
          rel="noopener noreferrer"
          class="text-caption text-accent-400 hover:text-accent-300 hover:underline">CSS selector reference</a
        >
      {/if}
      <div class="flex-1"></div>
      <select
        value={popupMode}
        onchange={(e) => switchPopupMode(e.currentTarget.value as PopupMode)}
        class="rounded border border-white/15 bg-white/10 py-1 px-2 text-caption text-white cursor-pointer"
        aria-label="Inspector mode"
      >
        <option value="pp-api">pp-api</option>
        <option value="css">CSS</option>
      </select>
      <button
        type="button"
        onclick={onCancel}
        class="p-1 rounded text-gray-500 hover:bg-white/10 hover:text-white"
        aria-label="Close popup">×</button
      >
    </div>

    <!-- Body -->
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <!-- Editor panel -->
      <div class="flex flex-col flex-1 min-w-0 p-3 gap-3">
        <div class={`flex-1 min-h-0 rounded-lg border border-gray-800 bg-gray-950 overflow-hidden ${popupMode === "pp-api" ? "" : "hidden"}`}>
          <div class="h-full w-full" bind:this={editorHost}></div>
        </div>
        <div
          class={`flex-1 min-h-0 rounded-lg border border-gray-800 bg-gray-950 overflow-hidden ${popupMode === "css" ? "" : "hidden"}`}
          role="region"
          aria-label="CSS selector editor"
        >
          <div class="h-full w-full" bind:this={cssEditorHost}></div>
        </div>

        {#if errorMessage}
          <div class="text-xs text-red-400">{errorMessage}</div>
        {/if}

        <div class="flex gap-2">
          {#if popupMode === "pp-api"}
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
          {:else}
            <button
              type="button"
              onclick={handleCssSave}
              class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-accent-500 text-gray-950 hover:bg-accent-400 transition-colors cursor-pointer"
              >Save</button
            >
            <button
              type="button"
              onclick={onCancel}
              class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-transparent text-gray-100 border border-white/20 hover:bg-white/10 transition-colors cursor-pointer"
              >Close</button
            >
          {/if}
        </div>
      </div>

      <!-- Properties panel -->
      <div class="flex flex-col w-64 max-w-64 min-w-0 border-l border-gray-800 bg-black/20 p-3 gap-3">
        {#if popupMode === "pp-api"}
          <div class="text-xs uppercase tracking-wide text-gray-500">Property filters</div>
        {/if}
        {#if popupMode === "pp-api" && !isActiveSpecialProperty}
          <div class="flex flex-col gap-1">
            <select
              value={filterOperator}
              onchange={(e) => (filterOperator = e.currentTarget.value as FilterOperator)}
              class="text-sm text-white bg-white/10 border border-white/15 py-1.5 px-2 rounded cursor-pointer"
            >
              <option value="contains">contains</option>
              <option value="matches">matches</option>
              <option value="keyExists">keyExists</option>
            </select>
          </div>
        {/if}

        <div class={`w-full rounded-md border border-gray-800 bg-gray-950 overflow-hidden ${popupMode === "pp-api" ? "" : "hidden"}`}>
          <div class="flex h-12 w-full bg-[#282824]">
            <div class="h-full min-w-0 flex-1 pl-2" bind:this={previewHost}></div>
            <div class="flex h-full w-8 shrink-0 items-center justify-center border-l border-gray-700/80">
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <div
                      {...props}
                      class="flex h-full w-full cursor-grab items-center justify-center text-[#e0c987] hover:bg-white/5 active:cursor-grabbing"
                      draggable="true"
                      ondragstart={handlePreviewDragStart}
                      role="button"
                      tabindex="0"
                      aria-label="Drag the filter snippet into the editor to insert it."
                    >
                      <GripVertical class="h-4 w-4" />
                    </div>
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    sideOffset={6}
                    class="rounded-md border border-gray-700 bg-[#1b1b1b] px-2 py-1 text-caption text-gray-100 shadow-lg"
                  >
                    Drag this snippet into the editor.
                    <Tooltip.Arrow class="fill-[#1b1b1b]" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          </div>
        </div>

        <p class={`text-gray-400 text-xs -mt-2 ${popupMode === "pp-api" ? "" : "hidden"}`}>
          Edit me or use the grip to drag me into the code editor on the left!
        </p>

        {#if popupMode === "pp-api"}
          <div class="text-xs uppercase tracking-wide text-gray-500">Properties</div>
          <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
            <div class="flex flex-col gap-2">
              {#each specialPropertyItems as item (item.key)}
                <button
                  type="button"
                  onclick={() => (selectedPropertyKey = item.key)}
                  class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer
              transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
                  aria-pressed={activePropertyKey === item.key}
                >
                  <div class="font-mono text-xs text-accent-500 truncate max-w-24">
                    {item.key}
                  </div>
                  {#if item.value.length > 18}
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <div
                            {...props}
                            title={item.value}
                            class="font-mono text-xs text-secondary-500 truncate text-right underline cursor-help"
                          >
                            {item.value.length} chars
                          </div>
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          sideOffset={6}
                          data-tooltip
                          class="max-w-[24em] break-all rounded-md border border-gray-700 bg-[#1b1b1b] px-2 py-1 text-caption text-gray-100 shadow-lg"
                        >
                          {item.value}
                          <Tooltip.Arrow class="fill-[#1b1b1b]" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  {:else}
                    <div class="font-mono text-xs text-secondary-500 truncate text-right">
                      {truncate(item.value, 30)}
                    </div>
                  {/if}
                </button>
              {/each}

              {#if specialPropertyItems.length > 0 && nonSpecialPropertyItems.length > 0}
                <hr class="border-gray-800" />
              {/if}

              {#each nonSpecialPropertyItems as item (item.key)}
                <button
                  type="button"
                  onclick={() => (selectedPropertyKey = item.key)}
                  class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer
              transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
                  aria-pressed={activePropertyKey === item.key}
                >
                  <div class="font-mono text-xs text-accent-500 truncate max-w-24">
                    {item.key}
                  </div>
                  {#if item.value.length > 18}
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <div
                            {...props}
                            title={item.value}
                            class="font-mono text-xs text-secondary-500 truncate text-right underline cursor-help"
                          >
                            {item.value.length} chars
                          </div>
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          sideOffset={6}
                          class="max-w-[24em] break-all rounded-md border border-gray-700 bg-[#1b1b1b] px-2 py-1 text-caption text-gray-100 shadow-lg"
                        >
                          {item.value}
                          <Tooltip.Arrow class="fill-[#1b1b1b]" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  {:else}
                    <div class="font-mono text-xs text-secondary-500 truncate text-right">
                      {truncate(item.value, 30)}
                    </div>
                  {/if}
                </button>
              {/each}

              {#if propertyItems.length === 0}
                <div class="col-span-full text-xs text-gray-500 text-center p-4">No properties available.</div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-2">
            {#if activeCssPart}
              <div class="space-y-[0.25em]">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[0.7em] uppercase tracking-wide text-gray-500">{activeCssPart.type}</span>
                  <span class="font-mono text-[0.8em] text-accent-400 break-all">{activeCssPart.displayText}</span>
                </div>
                <p class="text-[0.8em] text-gray-400">{activeCssPart.description}</p>
              </div>
            {:else}
              <div class="text-[0.8em] text-gray-500">
                Place the text caret on a selector part to inspect it.
              </div>
            {/if}
          </div>
          <p class="mt-auto text-[1em] text-gray-500">Hold alt/option to highlight matching elements</p>
        {/if}
      </div>
    </div>
  </Tooltip.Provider>
</div>
