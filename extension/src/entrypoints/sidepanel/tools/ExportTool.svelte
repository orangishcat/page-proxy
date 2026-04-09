<script lang="ts">
  import { Collapsible } from "bits-ui";
  import Button from "@/lib/components/Button.svelte";
  import { codeEditorContent } from "./code-editor/state";
  import { getEditorContext } from "../context/editor.svelte";
  import {
    buildWebsiteMetadataListing,
    extractWebsiteMetadataGlobs,
    normalizeScriptMetadataWebsites,
  } from "@/lib/utils/script-metadata";
  import {
    analyzeExportCompatibility,
    buildCssOnlyExport,
    buildPpScriptExport,
    buildTampermonkeyExport,
    type ExportFormat,
    type ExportOptions,
  } from "@/lib/script-export";

  const editorCtx = getEditorContext();

  type ExportFormatOption = {
    value: ExportFormat;
    label: string;
    available: boolean;
    reason?: string;
  };

  let selectedFormat = $state<ExportFormat>("pp-script");
  let statusMessage = $state<string | null>(null);
  let minify = $state(false);
  let isDeleteWarningVisible = $state(false);
  let isDeletingScript = $state(false);
  let metadataScrollContainer = $state<HTMLDivElement | null>(null);

  const editorContentValue = $derived($codeEditorContent);
  const exportCompatibility = $derived(analyzeExportCompatibility(editorContentValue));

  const exportFormatOptions = $derived<ExportFormatOption[]>([
    { value: "pp-script", label: "pp-script", available: true },
    {
      value: "tampermonkey",
      label: "Tampermonkey",
      available: exportCompatibility.tampermonkey.ok,
      reason: exportCompatibility.tampermonkey.reason,
    },
    {
      value: "css-only",
      label: exportCompatibility.cssOnly.ok ? "CSS stylesheet" : "CSS stylesheet (incompatible)",
      available: exportCompatibility.cssOnly.ok,
      reason: exportCompatibility.cssOnly.reason,
    },
    { value: "wxt-extension", label: "WXT extension (coming soon)", available: false },
  ]);

  const selectedFormatOption = $derived(
    exportFormatOptions.find((option) => option.value === selectedFormat) ?? exportFormatOptions[0],
  );

  const canExportSelectedFormat = $derived(selectedFormatOption.available);

  const normalizedWebsiteGlob = $derived(
    buildWebsiteMetadataListing(extractWebsiteMetadataGlobs(editorContentValue), editorCtx.scriptMetadata.website),
  );

  const downloadExportArtifact = (fileName: string, body: string, mimeType: string) => {
    const blob = new Blob([body], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);

    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = objectUrl;
    downloadAnchor.download = fileName;
    document.body.append(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    URL.revokeObjectURL(objectUrl);
    statusMessage = `Exported ${fileName}.`;
  };

  const exportOptions = $derived<ExportOptions>({
    minify,
  });

  const buildExportResult = async () => {
    switch (selectedFormat) {
      case "pp-script":
        return buildPpScriptExport(normalizeScriptMetadataWebsites(editorContentValue), exportOptions);
      case "tampermonkey":
        return buildTampermonkeyExport(editorContentValue, exportOptions);
      case "css-only":
        return buildCssOnlyExport(editorContentValue, exportOptions);
      default:
        return {
          ok: false as const,
          message: `${selectedFormatOption.label} is coming soon.`,
        };
    }
  };

  const handleExport = async () => {
    if (!canExportSelectedFormat) {
      statusMessage = selectedFormatOption.reason ?? `${selectedFormatOption.label} is coming soon.`;
      return;
    }

    if (editorContentValue.trim().length === 0) {
      statusMessage = "No script content available to export.";
      return;
    }

    const result = await buildExportResult();
    if (!result.ok) {
      statusMessage = result.message;
      return;
    }

    downloadExportArtifact(result.fileName, result.body, result.mimeType);
  };

  const forceMetadataScrollToBottom = () => {
    if (!metadataScrollContainer) {
      return;
    }

    metadataScrollContainer.scrollTop = metadataScrollContainer.scrollHeight;
  };

  const revealDeleteConfirmation = () => {
    forceMetadataScrollToBottom();
    requestAnimationFrame(forceMetadataScrollToBottom);
    window.setTimeout(forceMetadataScrollToBottom, 60);
  };

  const handleDeleteWarningOpenChange = (open: boolean) => {
    if (open) {
      statusMessage = null;
      revealDeleteConfirmation();
    }
    isDeleteWarningVisible = open;
  };

  const closeDeleteWarning = () => {
    if (isDeletingScript) {
      return;
    }

    isDeleteWarningVisible = false;
  };

  const deleteScript = async () => {
    if (isDeletingScript) {
      return;
    }

    isDeletingScript = true;
    try {
      await editorCtx.resetToDefault();
      statusMessage = "Script deleted. Restored default script.";
      isDeleteWarningVisible = false;
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : "Unable to delete script.";
    } finally {
      isDeletingScript = false;
    }
  };
</script>

<div class="flex w-full min-h-0 flex-1 flex-col gap-4 px-4 py-4">
  <div class="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1" bind:this={metadataScrollContainer}>
    <div class="grid grid-cols-[fit-content(7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-body whitespace-pre-line">
      <span class="min-w-0 text-right truncate text-gray-500">Title</span>
      <span class="min-w-0 wrap-break-word text-left font-mono"
        >{editorCtx.scriptMetadata.title || "Untitled script"}</span
      >

      <span class="min-w-0 text-right truncate text-gray-500">Website</span>
      <span class="min-w-0 wrap-break-word text-left font-mono">{normalizedWebsiteGlob || "Not set"}</span>

      <span class="min-w-0 text-right truncate text-gray-500">Description</span>
      <span class="min-w-0 wrap-break-word text-left font-mono"
        >{editorCtx.scriptMetadata.description || "No description"}</span
      >

      <span class="min-w-0 text-right truncate text-gray-500">Author</span>
      <span class="min-w-0 wrap-break-word text-left font-mono">{editorCtx.scriptMetadata.author || "No author"}</span>

      {#if editorCtx.scriptMetadata.credits.trim()}
        <span class="min-w-0 text-right truncate text-gray-500">Credits</span>
        <span class="min-w-0 wrap-break-word text-left font-mono">{editorCtx.scriptMetadata.credits}</span>
      {/if}

      <div class="col-span-2 my-1 border-t border-[#5b5542]"></div>

      <span class="min-w-0 text-right truncate text-gray-500">Minify</span>
      <label class="text-body flex min-w-0 items-center gap-2 text-left text-gray-100">
        <input class="shrink-0" type="checkbox" bind:checked={minify} />
        <span class="min-w-0 wrap-break-word">Minify exported output</span>
      </label>

      <div class="col-span-2 my-1 border-t border-[#5b5542]"></div>

      <span class="min-w-0 text-right truncate text-gray-500">Danger Zone</span>
      <Collapsible.Root bind:open={isDeleteWarningVisible} onOpenChange={handleDeleteWarningOpenChange}>
        <Collapsible.Trigger
          class="cursor-pointer font-mono text-red-400 underline decoration-red-400/80 underline-offset-2 transition hover:text-red-300"
        >
          Delete script
        </Collapsible.Trigger>

        <Collapsible.Content class="mt-2 w-full max-w-full min-w-0 p-1 text-gray-900 dark:text-gray-100">
          <p class="text-caption text-gray-700 dark:text-gray-200">Deleting this script cannot be undone.</p>
          <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button
              class="px-3! py-1! border border-gray-300 dark:border-gray-700"
              variant="outline"
              onclick={closeDeleteWarning}
              disabled={isDeletingScript}
            >
              Cancel
            </Button>
            <button
              type="button"
              class="rounded-xl border border-red-500 bg-red-500/12 px-3 py-1 text-caption text-red-500 transition hover:bg-red-500/20 dark:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              onclick={deleteScript}
              disabled={isDeletingScript}
            >
              {isDeletingScript ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  </div>

  <div class="mt-auto space-y-2">
    <div class="flex items-center gap-2">
      <label for="export-format" class="text-gray-500">Export format</label>
      <select
        id="export-format"
        class="h-8 flex-1 rounded-xl w-32 border border-[#5b5542] bg-[#2a2924] px-3 text-body text-gray-100 outline-none focus:border-accent-500"
        bind:value={selectedFormat}
      >
        {#each exportFormatOptions as formatOption (formatOption.value)}
          <option value={formatOption.value} disabled={!formatOption.available}>{formatOption.label}</option>
        {/each}
      </select>

      <Button class="px-4!" variant="primary" aria-label="Export script" onclick={handleExport}>Export</Button>
    </div>

    {#if statusMessage}
      <p class="text-caption text-gray-400">{statusMessage}</p>
    {/if}
  </div>
</div>
