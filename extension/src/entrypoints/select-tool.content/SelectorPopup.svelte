<script lang="ts">
  import type { ElementInfo, SelectorSavePayload } from "@/lib/selection";
  import { onDestroy, onMount } from "svelte";
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { indentWithTab } from "@codemirror/commands";

  import { buildCodeEditorExtensions } from "@/lib/code-editor";

  type PropertyItem = {
    key: string;
    label: string;
    value: string;
    rawValue: string | ElementInfo["boundingBox"];
    primary: boolean;
  };

  type FilterOperator = "contains" | "matches" | "keyExists";

  type Props = {
    info: ElementInfo;
    propertyItems: PropertyItem[];
    onSave: (payload: SelectorSavePayload) => void;
    onCancel: () => void;
  };

  let { info, propertyItems, onSave, onCancel }: Props = $props();

  let editorHost = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let editorValue = $state("");
  let dragCaret: HTMLDivElement | null = null;
  let lastInsertPos: number | null = null;

  let previewHost = $state<HTMLDivElement | null>(null);
  let previewView = $state<EditorView | null>(null);

  let filterOperator = $state<FilterOperator>("matches");
  let selectedPropertyKey = $state<string | null>(null);
  let errorMessage = $state("");

  const filterFunctionMap: Record<FilterOperator, string> = {
    contains: "propContains",
    matches: "propMatches",
    keyExists: "propExists",
  };

  const buildPropertiesBlock = () => {
    if (propertyItems.length === 0) {
      return "";
    }
    const lines = propertyItems
      .map((item) => `    ${JSON.stringify(item.key)}: ${JSON.stringify(item.value)}`)
      .join(",\n");
    return `\n${lines}\n  `;
  };

  const buildDefaultCode = () => {
    const propertiesBlock = buildPropertiesBlock();
    return [
      "const Style_1 = pp.selector({",
      `  ${JSON.stringify("name")}: ${JSON.stringify("Style 1")},`,
      `  ${JSON.stringify("selector")}: ${JSON.stringify(info.selector)},`,
      `  ${JSON.stringify("properties")}: {${propertiesBlock}},`,
      `  ${JSON.stringify("matches")}: (e) => pp.propMatches(e, ${JSON.stringify("selector")})`,
      "});",
    ].join("\n");
  };

  const buildPropertyValues = () =>
    Object.fromEntries(propertyItems.map((item) => [item.key, item.value] as const));

  const activePropertyKey = $derived.by(() => {
    if (selectedPropertyKey && propertyItems.some((item) => item.key === selectedPropertyKey)) {
      return selectedPropertyKey;
    }
    return propertyItems[0]?.key ?? null;
  });

  const previewCode = $derived.by(() => {
    const propertyKey = activePropertyKey ?? "selectedPropertyName";
    const functionName = filterFunctionMap[filterOperator];
    return `pp.${functionName}(e, ${JSON.stringify(propertyKey)})`;
  });

  const setupEditor = () => {
    if (!editorHost || editorView) {
      return;
    }

    editorValue = buildDefaultCode();

    const state = EditorState.create({
      doc: editorValue,
      extensions: [
        ...buildCodeEditorExtensions(),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            editorValue = update.state.doc.toString();
            errorMessage = "";
          }
        }),
      ],
    });

    editorView = new EditorView({
      state,
      parent: editorHost,
    });

    editorView.dom.style.position = "relative";
    dragCaret = document.createElement("div");
    dragCaret.style.position = "absolute";
    dragCaret.style.width = "0.0625rem";
    dragCaret.style.background = "rgb(224 201 135)";
    dragCaret.style.opacity = "0";
    dragCaret.style.pointerEvents = "none";
    editorView.dom.appendChild(dragCaret);

    editorView.dom.addEventListener("dragover", handleEditorDragOver, { capture: true });
    editorView.dom.addEventListener("drop", handleEditorDrop, { capture: true });
    editorView.dom.addEventListener("dragleave", handleEditorDragLeave, { capture: true });
  };

  const setupPreview = () => {
    if (!previewHost || previewView) {
      return;
    }

    const state = EditorState.create({
      doc: previewCode,
      extensions: [
        ...buildCodeEditorExtensions(),
        EditorView.editable.of(false),
        EditorView.theme({
          "&": { backgroundColor: "transparent" },
          ".cm-gutters": { display: "none" },
          ".cm-scroller": { overflowX: "auto", overflowY: "hidden" },
          ".cm-content": {
            padding: "0.25rem 0.5rem",
            whiteSpace: "pre",
            wordBreak: "normal",
            overflowWrap: "normal",
            pointerEvents: "none",
            userSelect: "none",
          },
          "&.cm-lineWrapping .cm-content": { whiteSpace: "pre" },
          ".cm-cursor": { display: "none" },
        }),
      ],
    });

    previewView = new EditorView({
      state,
      parent: previewHost,
    });

    previewView.dom.setAttribute("draggable", "true");
    previewView.dom.addEventListener("dragstart", handlePreviewDragStart, { capture: true });
    const previewContent = previewView.dom.querySelector(".cm-content");
    if (previewContent instanceof HTMLElement) {
      previewContent.setAttribute("draggable", "true");
    }
  };

  const handleSave = () => {
    const code = editorView?.state.doc.toString() ?? editorValue;
    if (!code.trim()) {
      errorMessage = "Add a selector definition to save.";
      return;
    }
    if (!code.includes("pp.selector")) {
      errorMessage = "Selector definition must include pp.selector.";
      return;
    }

    const payload: SelectorSavePayload = {
      name: null,
      selector: info.selector,
      bbox: info.boundingBox,
      properties: buildPropertyValues(),
      code,
    };

    onSave(payload);
  };

  const handlePreviewDragStart = (event: DragEvent) => {
    if (!event.dataTransfer) {
      return;
    }
    const code = previewCode;
    event.dataTransfer.setData("application/x-pp-filter", code);
    event.dataTransfer.setData("text/plain", code);
    event.dataTransfer.effectAllowed = "copy";
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

  const getInsertPosFromCoords = (coords: { x: number; y: number }) => {
    if (!editorView) {
      return null;
    }
    const pos = editorView.posAtCoords(coords);
    if (pos === null) {
      return null;
    }
    const line = editorView.state.doc.lineAt(pos);
    const offset = pos - line.from;
    const insertOffset = findNearestWordBreak(line.text, offset);
    return line.from + insertOffset;
  };

  const showDragCaret = (pos: number) => {
    if (!editorView || !dragCaret) {
      return;
    }
    const coords = editorView.coordsAtPos(pos);
    if (!coords) {
      return;
    }
    const hostRect = editorView.dom.getBoundingClientRect();
    dragCaret.style.left = `${coords.left - hostRect.left}px`;
    dragCaret.style.top = `${coords.top - hostRect.top}px`;
    dragCaret.style.height = `${coords.bottom - coords.top}px`;
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
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";

    const insertPos = getInsertPosFromCoords({ x: event.clientX, y: event.clientY });
    if (insertPos === null || insertPos === lastInsertPos) {
      return;
    }
    lastInsertPos = insertPos;
    showDragCaret(insertPos);
  };

  const handleEditorDrop = (event: DragEvent) => {
    if (!editorView || !event.dataTransfer) {
      return;
    }

    const code =
      event.dataTransfer.getData("application/x-pp-filter") ||
      event.dataTransfer.getData("text/plain");

    if (!code) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    hideDragCaret();

    const insertPos = getInsertPosFromCoords({ x: event.clientX, y: event.clientY });
    if (insertPos === null) {
      return;
    }

    editorView.dispatch({
      changes: { from: insertPos, to: insertPos, insert: code },
      selection: { anchor: insertPos + code.length },
    });
    editorView.focus();
  };

  const handleEditorDragLeave = (event: DragEvent) => {
    if (!editorView || !(event.relatedTarget instanceof Node)) {
      hideDragCaret();
      return;
    }
    if (!editorView.dom.contains(event.relatedTarget)) {
      hideDragCaret();
    }
  };

  const truncate = (val: string, max: number) => (val.length > max ? `${val.slice(0, max)}…` : val);

  onMount(() => {
    setupEditor();
    setupPreview();
  });

  onDestroy(() => {
    if (editorView) {
      editorView.dom.removeEventListener("dragover", handleEditorDragOver, { capture: true });
      editorView.dom.removeEventListener("drop", handleEditorDrop, { capture: true });
      editorView.dom.removeEventListener("dragleave", handleEditorDragLeave, { capture: true });
      if (dragCaret) {
        dragCaret.remove();
        dragCaret = null;
      }
      editorView.destroy();
      editorView = null;
    }
    if (previewView) {
      previewView.dom.removeEventListener("dragstart", handlePreviewDragStart);
      previewView.destroy();
      previewView = null;
    }
  });

  $effect(() => {
    if (!previewView) {
      return;
    }
    const currentValue = previewView.state.doc.toString();
    if (previewCode === currentValue) {
      return;
    }
    previewView.dispatch({
      changes: { from: 0, to: previewView.state.doc.length, insert: previewCode },
    });
  });
</script>

<div
  class="flex flex-col w-full h-full overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-gray-100 font-sans text-sm shadow-2xl darkreader"
>
  <!-- Header -->
  <div class="flex items-center h-12 px-4 gap-2.5 bg-gray-900 border-b border-gray-800">
    <span class="text-base font-normal text-gray-500">Selector editor</span>
    <div class="flex-1"></div>
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
          class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-accent-500 text-gray-950 hover:bg-accent-400 transition-colors"
          >Save</button
        >
        <button
          type="button"
          onclick={onCancel}
          class="flex-1 rounded-md py-2 px-4 text-sm font-medium bg-transparent text-gray-100 border border-white/20 hover:bg-white/10 transition-colors"
          >Cancel</button
        >
      </div>
    </div>

    <!-- Properties panel -->
    <div class="flex flex-col w-64 max-w-64 min-w-0 border-l border-gray-800 bg-black/20 overflow-y-auto p-3 gap-3">
      <div class="text-xs uppercase tracking-wide text-gray-500">Property filters</div>
      <select
        value={filterOperator}
        onchange={(e) => (filterOperator = e.currentTarget.value as FilterOperator)}
        class="text-sm text-white bg-white/10 border border-white/15 py-1.5 px-2 rounded cursor-pointer"
      >
        <option value="contains">contains</option>
        <option value="matches">matches</option>
        <option value="keyExists">keyExists</option>
      </select>

      <div
        class="w-full rounded-md border border-gray-800 bg-gray-950 overflow-hidden"
        draggable="true"
        ondragstart={handlePreviewDragStart}
        role="button"
        tabindex="0"
        aria-label="Drag the filter snippet into the editor to insert it."
        title="Drag into the editor to insert."
      >
        <div class="h-10 w-full" bind:this={previewHost}></div>
      </div>

      <div class="text-xs uppercase tracking-wide text-gray-500">Properties</div>
      <div class="flex flex-col gap-2">
        {#each propertyItems as item (item.key)}
          <button
            type="button"
            onclick={() => (selectedPropertyKey = item.key)}
            class={`flex justify-between items-center text-left rounded-md border border-transparent px-2 py-1 transition-colors hover:bg-white/10 ${activePropertyKey === item.key ? "bg-white/10 border-white/10" : ""}`}
            aria-pressed={activePropertyKey === item.key}
          >
            <div class="font-mono text-xs text-accent-500 truncate max-w-24">
              {item.key}
            </div>
            <div
              class="font-mono text-xs text-secondary-500 truncate text-right"
              class:underline={item.value.length > 18}
              class:cursor-help={item.value.length > 18}
              title={item.value.length > 18 ? item.value : undefined}
            >
              {item.value.length > 18 ? `${item.value.length} chars` : truncate(item.value, 30)}
            </div>
          </button>
        {/each}
        {#if propertyItems.length === 0}
          <div class="col-span-full text-xs text-gray-500 text-center p-4">No properties available.</div>
        {/if}
      </div>
    </div>
  </div>
</div>
