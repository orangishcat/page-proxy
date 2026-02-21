<script lang="ts">
  import type { ElementInfo, SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { Tooltip } from "bits-ui";
  import { onDestroy, onMount } from "svelte";
  import CssInspector from "./CssInspector.svelte";
  import {
    createMonacoEditor,
    MonacoRange,
    type MonacoCodeEditorHandle,
    updateMonacoEditorValue,
  } from "@/lib/code-editor";
  import { GripVertical } from "lucide-svelte";
  import { buildPreviewCode, isSpecialPropertyKey, type FilterOperator } from "./preview-code";
  import { appendSnippetToSelector, parseCssSelectorParts, type CssSelectorPart } from "./css-inspector";

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
    targetElement: Element | null;
    onSave: (payload: SelectorSavePayload) => Promise<SelectorSaveResult>;
    onCancel: () => void;
    onVisibilityChange?: (hidden: boolean) => void;
  };

  let { info, propertyItems, targetElement, onSave, onCancel, onVisibilityChange }: Props = $props();

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let editorValue = $state("");
  let dragCaret: HTMLDivElement | null = null;
  let lastInsertPos: { lineNumber: number; column: number } | null = null;
  let cssEditorHost = $state<HTMLDivElement | null>(null);
  let cssEditorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let cssEditorValue = $state("");
  let hoveredCssOffset = $state<number | null>(null);
  let isMatchPreviewing = $state(false);
  let isCssStylePreviewing = $state(false);
  let isCssEditorFocused = $state(false);
  let highlightedPreviewElements: Element[] = [];
  let highlightedPreviewCount = $state(0);
  let cssPreviewErrorMessage = $state<string | null>(null);
  let highlightNoticeElement: HTMLDivElement | null = null;
  let cssStylePreviewElement: HTMLStyleElement | null = null;
  let disposeCssCursorChange: (() => void) | null = null;
  let disposeCssFocus: (() => void) | null = null;
  let disposeCssBlur: (() => void) | null = null;

  let previewHost = $state<HTMLDivElement | null>(null);
  let previewHandle = $state<MonacoCodeEditorHandle | null>(null);
  let previewValue = $state("");

  let filterOperator = $state<FilterOperator>("matches");
  let selectedPropertyKey = $state<string | null>(null);
  let propertySearchTerm = $state("");
  let errorMessage = $state("");
  type PopupMode = "pp-api" | "css";
  let popupMode = $state<PopupMode>("pp-api");
  const hoveredPreviewClass = "pp-hovered";

  const transparentDragImage = new Image();
  transparentDragImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  const baseSelectorPattern = /(["']baseSelector["']\s*:\s*)(["'`])((?:\\.|(?!\2)[\s\S])*?)\2/;
  const cssDeclarationPattern = /^([a-zA-Z-][\w-]*)\s*:\s*(.+?)\s*;?$/;

  type CssComputedStyleProperty = {
    key: string;
    value: string;
    originalValue: string;
    edited: boolean;
    originalOrder: number;
    declarationOrder: number | null;
  };

  type ParsedCssDeclaration = {
    key: string;
    value: string;
    order: number;
  };

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
    let currentLine = "";

    parts.forEach((part) => {
      if (part.type === "descendant") {
        if (currentLine.length > 0 && !currentLine.endsWith(" ")) {
          currentLine = `${currentLine} `;
        }
        return;
      }
      if (part.type === "group") {
        if (currentLine.trim().length > 0) {
          lines.push(`${currentLine.trimEnd()},`);
          currentLine = "";
          return;
        }
        if (lines.length > 0) {
          lines[lines.length - 1] = `${lines[lines.length - 1].trimEnd()},`;
          return;
        }
        lines.push(",");
        return;
      }
      if (part.type === "combinator") {
        if (currentLine.trim().length === 0) {
          return;
        }
        lines.push(`${currentLine.trimEnd()} ${part.text}`);
        currentLine = "";
        return;
      }

      if (currentLine.length === 0) {
        currentLine = part.text;
        return;
      }

      const attachesDirectly =
        part.type === "class" || part.type === "id" || part.type === "attribute" || part.type === "pseudo";
      if (attachesDirectly) {
        currentLine = `${currentLine.trimEnd()}${part.text}`;
        return;
      }

      if (currentLine.endsWith(" ")) {
        currentLine = `${currentLine}${part.text}`;
        return;
      }

      currentLine = `${currentLine.trimEnd()} ${part.text}`;
    });

    if (currentLine.trim().length > 0) {
      lines.push(currentLine.trimEnd());
    }

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

  const readDefaultComputedStyleValueMap = (sourceElement: Element) => {
    const targetTagName =
      sourceElement instanceof HTMLElement && sourceElement.tagName.length > 0
        ? sourceElement.tagName.toLowerCase()
        : "div";
    const host = document.body ?? document.documentElement;
    if (!host) {
      return new Map<string, string>();
    }

    const dummyElement = document.createElement(targetTagName);
    dummyElement.classList.add("pp-no-select-tool");
    dummyElement.setAttribute("aria-hidden", "true");
    dummyElement.style.position = "fixed";
    dummyElement.style.left = "-9999px";
    dummyElement.style.top = "-9999px";
    dummyElement.style.visibility = "hidden";
    dummyElement.style.pointerEvents = "none";
    host.appendChild(dummyElement);

    const defaultComputedStyle = getComputedStyle(dummyElement);
    const defaultValues = new Map<string, string>();
    for (let index = 0; index < defaultComputedStyle.length; index += 1) {
      const key = defaultComputedStyle.item(index);
      if (!key) {
        continue;
      }
      defaultValues.set(key, defaultComputedStyle.getPropertyValue(key).trim());
    }

    dummyElement.remove();
    return defaultValues;
  };

  const readComputedStyleEntries = (element: Element | null) => {
    if (!element?.isConnected) {
      return [] as Array<{ key: string; value: string; originalOrder: number }>;
    }

    const defaultValues = readDefaultComputedStyleValueMap(element);
    const computedStyle = getComputedStyle(element);
    const entries: Array<{ key: string; value: string; originalOrder: number }> = [];
    for (let index = 0; index < computedStyle.length; index += 1) {
      const key = computedStyle.item(index);
      if (!key) {
        continue;
      }
      const value = computedStyle.getPropertyValue(key).trim();
      const defaultValue = defaultValues.get(key) ?? "";
      if (value === defaultValue) {
        continue;
      }
      entries.push({
        key,
        value,
        originalOrder: index,
      });
    }

    return entries;
  };

  const parseCssDeclarations = (declarations: string): ParsedCssDeclaration[] => {
    return declarations
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, order) => {
        const match = line.match(cssDeclarationPattern);
        if (!match) {
          return null;
        }
        return {
          key: match[1].toLowerCase(),
          value: match[2].trim(),
          order,
        } satisfies ParsedCssDeclaration;
      })
      .filter((entry): entry is ParsedCssDeclaration => entry !== null);
  };

  const serializeCssDeclarations = (declarations: ParsedCssDeclaration[]) =>
    declarations.map((declaration) => `${declaration.key}: ${declaration.value};`).join("\n");

  const upsertCssDeclaration = (declarations: string, key: string, value: string) => {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) {
      return declarations;
    }

    const parsed = parseCssDeclarations(declarations);
    const existingIndex = parsed.findIndex((entry) => entry.key === normalizedKey);
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      if (existingIndex >= 0) {
        parsed.splice(existingIndex, 1);
      }
      return serializeCssDeclarations(parsed);
    }

    if (existingIndex >= 0) {
      parsed[existingIndex] = { ...parsed[existingIndex], value: trimmedValue };
      return serializeCssDeclarations(parsed);
    }

    return serializeCssDeclarations([
      ...parsed,
      {
        key: normalizedKey,
        value: trimmedValue,
        order: parsed.length,
      },
    ]);
  };

  const removeCssDeclaration = (declarations: string, key: string) => {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) {
      return declarations;
    }
    const parsed = parseCssDeclarations(declarations).filter((entry) => entry.key !== normalizedKey);
    return serializeCssDeclarations(parsed);
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
  const normalizedPropertySearchTerm = $derived.by(() => propertySearchTerm.trim().toLowerCase());
  const filteredSpecialPropertyItems = $derived.by(() =>
    specialPropertyItems.filter((item) => {
      const searchTerm = normalizedPropertySearchTerm;
      if (!searchTerm) {
        return true;
      }
      return item.key.toLowerCase().includes(searchTerm) || item.value.toLowerCase().includes(searchTerm);
    }),
  );
  const filteredNonSpecialPropertyItems = $derived.by(() =>
    nonSpecialPropertyItems.filter((item) => {
      const searchTerm = normalizedPropertySearchTerm;
      if (!searchTerm) {
        return true;
      }
      return item.key.toLowerCase().includes(searchTerm) || item.value.toLowerCase().includes(searchTerm);
    }),
  );

  const isActiveSpecialProperty = $derived.by(() => isSpecialPropertyKey(activePropertyKey));

  const currentBaseSelector = $derived.by(() => {
    return readBaseSelectorFromCode(editorValue) ?? info.selector;
  });

  const cssSelectorSource = $derived.by(() => readSelectorSourceFromCssEditor(cssEditorValue));

  const activeCssSelector = $derived.by(() => {
    return popupMode === "css" ? cssSelectorSource : currentBaseSelector;
  });

  const cssSelectorParts = $derived.by(() => parseCssSelectorParts(activeCssSelector));
  const hasNthOfTypeRule = $derived.by(
    () => popupMode === "css" && cssSelectorParts.some((part) => part.type === "pseudo" && /^:nth-of-type\(/i.test(part.text)),
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
    if (currentOffset === null) {
      return null;
    }
    if (popupMode === "css" && currentOffset >= cssSelectorSource.length) {
      return null;
    }

    return cssSelectorParts.find((part) => currentOffset >= part.startOffset && currentOffset < part.endOffset) ?? null;
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

  const removeNthOfTypeFromCssSelector = () => {
    if (popupMode !== "css" || !cssEditorHandle) {
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

  const handleCssSave = async () => {
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

  const clearPreviewHighlights = () => {
    highlightedPreviewElements.forEach((element) => {
      element.classList.remove(hoveredPreviewClass);
    });
    highlightedPreviewElements = [];
    highlightedPreviewCount = 0;
  };

  const getSelectorPreviewState = (selector: string) => {
    const normalizedSelector = selector.trim();
    if (!normalizedSelector) {
      return { matchingElements: [] as Element[], error: "CSS selector is invalid." };
    }

    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return { matchingElements: [] as Element[], error: "CSS selector is invalid." };
    }

    if (!CSS.supports(`selector(${normalizedSelector})`)) {
      return { matchingElements: [] as Element[], error: "CSS selector is invalid." };
    }

    const matchingElements = Array.from(document.querySelectorAll(normalizedSelector)).filter(
      (element) => !element.closest(".pp-no-select-tool"),
    );
    if (matchingElements.length === 0) {
      return { matchingElements, error: "CSS selector matches no elements." };
    }

    return { matchingElements, error: null };
  };

  const updateCssPreviewErrorMessage = () => {
    if (popupMode !== "css") {
      cssPreviewErrorMessage = null;
      return;
    }
    const selector = normalizeSelectorFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    cssPreviewErrorMessage = getSelectorPreviewState(selector).error;
  };

  const applyPreviewHighlights = () => {
    clearPreviewHighlights();
    if (popupMode !== "css") {
      return;
    }

    const selector = normalizeSelectorFromCssEditor(cssEditorHandle?.editor.getValue() ?? cssEditorValue);
    const previewState = getSelectorPreviewState(selector);
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
    if (popupMode !== "css") {
      return;
    }

    const currentCssDocument = cssEditorHandle?.editor.getValue() ?? cssEditorValue;
    const selector = normalizeSelectorFromCssEditor(currentCssDocument);
    const declarations = readDeclarationSourceFromCssEditor(currentCssDocument);
    if (!declarations.trim()) {
      cssPreviewErrorMessage = "Add at least one CSS declaration to preview applied styles.";
      return;
    }

    const previewState = getSelectorPreviewState(selector);
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
    if (popupMode !== "css") {
      return;
    }
    if (isCssEditorFocused) {
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
        if (isMatchPreviewing) {
          applyPreviewHighlights();
        }
        if (isCssStylePreviewing) {
          applyCssStylePreview();
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
    stopPreviewModes();
    removeHighlightNotice();
    onVisibilityChange?.(false);

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
      stopPreviewModes();
      isCssEditorFocused = false;
      updateCssPreviewErrorMessage();
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

    updateCssPreviewErrorMessage();
  });

  $effect(() => {
    if (!isMatchPreviewing) {
      return;
    }
    applyPreviewHighlights();
  });

  $effect(() => {
    if (isMatchPreviewing && popupMode === "css") {
      showHighlightNotice(highlightedPreviewCount);
      return;
    }
    removeHighlightNotice();
  });

  $effect(() => {
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

<div
  class="flex flex-col w-full h-full overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-gray-100 font-sans text-sm shadow-2xl pp-content-ui-root"
  style={`color-scheme: dark; ${popupMode === "css" ? "font-size: 16px !important;" : ""}`}
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
        <div
          class={`flex-1 min-h-0 rounded-lg border border-gray-800 bg-gray-950 overflow-hidden ${popupMode === "pp-api" ? "" : "hidden"}`}
        >
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

        <div
          class={`w-full rounded-md border border-gray-800 bg-gray-950 overflow-hidden ${popupMode === "pp-api" ? "" : "hidden"}`}
        >
          <div class="flex h-12 w-full bg-gray-900">
            <div class="h-full min-w-0 flex-1 pl-2" bind:this={previewHost}></div>
            <div class="flex h-full w-8 shrink-0 items-center justify-center border-l border-gray-700/80">
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <div
                      {...props}
                      class="flex h-full w-full cursor-grab items-center justify-center text-accent-400 hover:bg-white/5 active:cursor-grabbing"
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
                    class="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-caption text-gray-100 shadow-lg"
                  >
                    Drag this snippet into the editor.
                    <Tooltip.Arrow class="fill-gray-900" />
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
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs uppercase tracking-wide text-gray-500">Properties</div>
            <input
              type="search"
              bind:value={propertySearchTerm}
              placeholder="Search"
              class="h-6 w-28 rounded border border-white/15 bg-white/5 px-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-white/25 focus:outline-none"
              aria-label="Search properties"
            />
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
            <div class="flex flex-col gap-2">
              {#each filteredSpecialPropertyItems as item (item.key)}
                <button
                  type="button"
                  onclick={() => (selectedPropertyKey = item.key)}
                  class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer
              transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
                  aria-pressed={activePropertyKey === item.key}
                >
                  <div title={item.key} class="font-mono text-xs text-accent-500 truncate max-w-24">
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
                          class="max-w-96 break-all rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-caption text-gray-100 shadow-lg"
                        >
                          {item.value}
                          <Tooltip.Arrow class="fill-gray-900" />
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

              {#if filteredSpecialPropertyItems.length > 0 && filteredNonSpecialPropertyItems.length > 0}
                <hr class="border-gray-800" />
              {/if}

              {#each filteredNonSpecialPropertyItems as item (item.key)}
                <button
                  type="button"
                  onclick={() => (selectedPropertyKey = item.key)}
                  class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer
              transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
                  aria-pressed={activePropertyKey === item.key}
                >
                  <div title={item.key} class="font-mono text-xs text-accent-500 truncate max-w-24">
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
                          class="max-w-96 break-all rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-caption text-gray-100 shadow-lg"
                        >
                          {item.value}
                          <Tooltip.Arrow class="fill-gray-900" />
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

              {#if filteredSpecialPropertyItems.length === 0 && filteredNonSpecialPropertyItems.length === 0}
                <div class="col-span-full text-xs text-gray-500 text-center p-4">No properties available.</div>
              {/if}
            </div>
          </div>
        {:else}
          <CssInspector
            {activeCssPart}
            propertyItems={cssPropertyItems}
            computedStyleProperties={cssComputedStyleProperties}
            {hasNthOfTypeRule}
            {isCssEditorFocused}
            {cssPreviewErrorMessage}
            onRemoveNthOfType={removeNthOfTypeFromCssSelector}
            onUpdateComputedStyleValue={handleCssComputedPropertyChange}
            onRevertComputedStyleValue={handleCssComputedPropertyRevert}
          />
        {/if}
      </div>
    </div>
  </Tooltip.Provider>
</div>
