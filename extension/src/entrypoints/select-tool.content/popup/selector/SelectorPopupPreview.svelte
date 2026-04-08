<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Tooltip } from "bits-ui";
  import { GripVertical } from "lucide-svelte";
  import { createMonacoEditor, type MonacoCodeEditorHandle, updateMonacoEditorValue } from "@/lib/code-editor";
  import { transparentDragImage } from "./selector-popup-dnd";

  type Props = {
    code: string;
  };

  let { code }: Props = $props();

  let previewHost: HTMLDivElement | null = null;
  let previewHandle: MonacoCodeEditorHandle | null = null;
  let destroyed = false;

  const handlePreviewDragStart = (event: DragEvent) => {
    if (!event.dataTransfer) {
      return;
    }

    event.dataTransfer.setData("application/x-pp-filter", code);
    event.dataTransfer.setData("text/plain", code);
    event.dataTransfer.effectAllowed = "copy";
    if (transparentDragImage) {
      event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
    }
  };

  onMount(() => {
    if (!previewHost) {
      return;
    }

    const nextHandle = createMonacoEditor(previewHost, code, {
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
    if (destroyed) {
      nextHandle.dispose();
      return;
    }

    previewHandle = nextHandle;
  });

  onDestroy(() => {
    destroyed = true;
    previewHandle?.dispose();
    previewHandle = null;
  });

  $effect(() => {
    if (!previewHandle) {
      return;
    }

    const currentValue = previewHandle.editor.getValue();
    if (currentValue === code) {
      return;
    }

    updateMonacoEditorValue(previewHandle, code);
  });
</script>

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
