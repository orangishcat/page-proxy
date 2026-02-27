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
  import { buildSelectorTemplateCode } from "./popup/selector";

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
    baseSelector: string;
    onBaseSelectorChange?: (nextSelector: string) => void;
  };

  let { info, propertyItems, onSave, onCancel, baseSelector, onBaseSelectorChange }: Props = $props();

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorHandle = $state<MonacoCodeEditorHandle | null>(null);
  let editorValue = $state("");
  let dragCaret: HTMLDivElement | null = null;
  let lastInsertPos: { lineNumber: number; column: number } | null = null;

  let previewHost = $state<HTMLDivElement | null>(null);
  let previewHandle = $state<MonacoCodeEditorHandle | null>(null);
  let previewValue = $state("");

  let filterOperator = $state<FilterOperator>("matches");
  let selectedPropertyKey = $state<string | null>(null);
  let propertySearchTerm = $state("");
  let errorMessage = $state("");

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

  const replaceBaseSelectorInCode = (code: string, nextSelector: string): string | null => {
    if (!baseSelectorPattern.test(code)) {
      return null;
    }

    return code.replace(baseSelectorPattern, (_match, prefix: string, quote: string) => {
      return `${prefix}${quote}${escapeForQuote(nextSelector, quote)}${quote}`;
    });
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
  const currentBaseSelector = $derived.by(() => readBaseSelectorFromCode(editorValue) ?? info.selector);
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

  const setBaseSelectorInCode = (nextSelector: string) => {
    const normalizedSelector = nextSelector.trim();
    if (!normalizedSelector) {
      errorMessage = "Selector cannot be empty.";
      return false;
    }

    const currentCode = editorHandle?.editor.getValue() ?? editorValue;
    const nextCode = replaceBaseSelectorInCode(currentCode, normalizedSelector);
    if (!nextCode) {
      errorMessage = "Unable to update baseSelector.";
      return false;
    }

    setSelectorEditorCode(nextCode);
    onBaseSelectorChange?.(normalizedSelector);
    errorMessage = "";
    return true;
  };

  const needsDirectAppend = (snippet: string) => /^[.#[:]/.test(snippet);

  const appendSelectorSnippet = (baseValue: string, snippetValue: string) => {
    const base = baseValue.trim();
    const normalizedSnippet = snippetValue === " " ? " " : snippetValue.trim();

    if (!normalizedSnippet && snippetValue !== " ") {
      return base;
    }
    if (!base) {
      return normalizedSnippet;
    }
    if (normalizedSnippet === " ") {
      return `${base} `;
    }
    if (normalizedSnippet === "," || normalizedSnippet === ">" || normalizedSnippet === "+" || normalizedSnippet === "~") {
      return `${base} ${normalizedSnippet} `;
    }
    if (base.endsWith(",") || base.endsWith(">") || base.endsWith("+") || base.endsWith("~")) {
      return `${base} ${normalizedSnippet}`;
    }
    if (needsDirectAppend(normalizedSnippet)) {
      return `${base}${normalizedSnippet}`;
    }
    return `${base} ${normalizedSnippet}`;
  };

  const setupEditor = () => {
    if (!editorHost || editorHandle) {
      return;
    }

    const initialSelector = baseSelector.trim() || info.selector;
    editorValue = buildSelectorTemplateCode(initialSelector);

    editorHandle = createMonacoEditor(editorHost, editorValue, {
      language: "javascript",
      modelUri: "inmemory://page-proxy/selector-popup-editor.js",
      onChange: (nextValue) => {
        editorValue = nextValue;
        errorMessage = "";

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

  const setupPreview = () => {
    if (!previewHost || previewHandle) {
      return;
    }

    previewHandle = createMonacoEditor(previewHost, previewCode, {
      language: "javascript",
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
      errorMessage = "Selector definition must include pq.selector.";
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
    event.dataTransfer.setData("application/x-pp-filter", code);
    event.dataTransfer.setData("text/plain", code);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
  };

  const findNearestWordBreak = (text: string, offset: number) => {
    const breakChars = new Set([".", ",", " "]);
    const candidates = [0, text.length];

    for (let index = 0; index < text.length; index += 1) {
      if (breakChars.has(text[index])) {
        candidates.push(index, index + 1);
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

    const selectorSnippet = event.dataTransfer.getData("application/x-pp-selector-snippet");
    if (selectorSnippet) {
      event.preventDefault();
      event.stopImmediatePropagation();
      hideDragCaret();
      const nextSelector = appendSelectorSnippet(currentBaseSelector, selectorSnippet);
      setBaseSelectorInCode(nextSelector);
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

  const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max)}…` : value);

  onMount(() => {
    setupEditor();
    setupPreview();
  });

  onDestroy(() => {
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
    if (!editorHandle) {
      return;
    }

    const normalizedSelector = baseSelector.trim();
    if (!normalizedSelector) {
      return;
    }

    const currentCode = editorHandle.editor.getValue();
    const currentSelector = readBaseSelectorFromCode(currentCode);
    if (currentSelector === normalizedSelector) {
      return;
    }

    const nextCode = replaceBaseSelectorInCode(currentCode, normalizedSelector);
    if (!nextCode) {
      return;
    }

    setSelectorEditorCode(nextCode);
  });
</script>

<Tooltip.Provider>
  <div class="flex h-full min-h-0 overflow-hidden">
    <div class="flex flex-col flex-1 min-w-0 p-3 gap-3">
      <div class="flex-1 min-h-0 rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
        <div class="h-full w-full" bind:this={editorHost}></div>
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

    <div class="flex flex-col w-64 max-w-64 min-w-0 border-l border-gray-800 bg-black/20 p-3 gap-3">
      <div class="text-xs uppercase tracking-wide text-gray-500">Property filters</div>

      {#if !isActiveSpecialProperty}
        <div class="flex flex-col gap-1">
          <select
            value={filterOperator}
            onchange={(event) => (filterOperator = event.currentTarget.value as FilterOperator)}
            class="text-sm text-white bg-white/10 border border-white/15 py-1.5 px-2 rounded cursor-pointer"
          >
            <option value="contains">contains</option>
            <option value="matches">matches</option>
            <option value="keyExists">keyExists</option>
          </select>
        </div>
      {/if}

      <div class="w-full rounded-md border border-gray-800 bg-gray-950 overflow-hidden">
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

      <p class="text-gray-400 text-xs -mt-2">Edit me or use the grip to drag me into the code editor on the left!</p>

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
              class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
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

          {#if filteredSpecialPropertyItems.length > 0 && filteredNonSpecialPropertyItems.length > 0}
            <hr class="border-gray-800" />
          {/if}

          {#each filteredNonSpecialPropertyItems as item (item.key)}
            <button
              type="button"
              onclick={() => (selectedPropertyKey = item.key)}
              class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 cursor-pointer transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
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
    </div>
  </div>
</Tooltip.Provider>
