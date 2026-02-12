<script lang="ts">
  import Button from "@/lib/components/Button.svelte";
  import { codeEditorContent, scriptMetadata, type ScriptMetadataState } from "./code-editor/state";

  type ExportFormat = "pp-script" | "tampermonkey" | "css-only" | "wxt-extension";

  type ExportFormatOption = {
    value: ExportFormat;
    label: string;
    available: boolean;
  };

  const exportFormatOptions: ExportFormatOption[] = [
    { value: "pp-script", label: "pp-script", available: true },
    { value: "tampermonkey", label: "tampermonkey (coming soon)", available: false },
    { value: "css-only", label: "css only (coming soon)", available: false },
    { value: "wxt-extension", label: "WXT extension (coming soon)", available: false },
  ];

  let selectedFormat = $state<ExportFormat>("pp-script");
  let statusMessage = $state<string | null>(null);

  let scriptMetadataValue = $state<ScriptMetadataState>({
    title: "Page Proxy",
    website: "",
    description: "",
  });
  let editorContentValue = $state("");

  const selectedFormatOption = $derived(
    exportFormatOptions.find((option) => option.value === selectedFormat) ?? exportFormatOptions[0],
  );

  const canExportSelectedFormat = $derived(selectedFormatOption.available);

  const normalizedWebsiteGlob = $derived(scriptMetadataValue.website.trim());

  $effect(() => {
    const unsubscribeScriptMetadata = scriptMetadata.subscribe((value) => {
      scriptMetadataValue = value;
    });

    const unsubscribeCodeEditorContent = codeEditorContent.subscribe((value) => {
      editorContentValue = value;
    });

    return () => {
      unsubscribeScriptMetadata();
      unsubscribeCodeEditorContent();
    };
  });

  const buildFileName = () => {
    const title = scriptMetadataValue.title.trim();
    const normalized = (title.length > 0 ? title : "page-proxy-script")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${normalized || "page-proxy-script"}.js`;
  };

  const downloadPpScript = () => {
    const fileName = buildFileName();
    const blob = new Blob([editorContentValue], { type: "text/javascript;charset=utf-8" });
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

  const handleExport = () => {
    if (!canExportSelectedFormat) {
      statusMessage = `${selectedFormatOption.label} is coming soon.`;
      return;
    }

    if (editorContentValue.trim().length === 0) {
      statusMessage = "No script content available to export.";
      return;
    }

    downloadPpScript();
  };
</script>

<div class="flex w-full min-h-0 flex-1 flex-col gap-4 px-4 py-4">
  <div class="rounded-2xl border border-[#4f4a38] bg-[#24231f] p-4">
    <h2 class="text-subtitle text-gray-100">Export</h2>
    <p class="mt-1 text-caption text-gray-400">Live script metadata from the editor.</p>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
    <div class="rounded-xl border border-[#4f4a38] bg-[#2d2b25] p-3">
      <p class="text-caption uppercase tracking-wide text-gray-500">Title</p>
      <p class="mt-1 text-body text-gray-100 break-words">{scriptMetadataValue.title || "Untitled script"}</p>
    </div>

    <div class="rounded-xl border border-[#4f4a38] bg-[#2d2b25] p-3">
      <p class="text-caption uppercase tracking-wide text-gray-500">Website glob</p>
      <p class="mt-1 text-body text-accent-500 break-all">{normalizedWebsiteGlob || "Not set"}</p>
    </div>

    <div class="rounded-xl border border-[#4f4a38] bg-[#2d2b25] p-3">
      <p class="text-caption uppercase tracking-wide text-gray-500">Description</p>
      <p class="mt-1 text-body text-gray-200 whitespace-pre-wrap break-words">{scriptMetadataValue.description || "No description"}</p>
    </div>
  </div>

  <div class="mt-auto space-y-2">
    <div class="flex items-center gap-2">
      <label class="sr-only" for="export-format">Export format</label>
      <select
        id="export-format"
        class="h-10 flex-1 rounded-xl border border-[#5b5542] bg-[#2a2924] px-3 text-body text-gray-100 outline-none focus:border-accent-500"
        bind:value={selectedFormat}
      >
        {#each exportFormatOptions as formatOption (formatOption.value)}
          <option value={formatOption.value}>{formatOption.label}</option>
        {/each}
      </select>

      <Button
        class="h-10 px-4!"
        variant="primary"
        aria-label="Export script"
        onclick={handleExport}
      >
        Export
      </Button>
    </div>

    {#if statusMessage}
      <p class="text-caption text-gray-400">{statusMessage}</p>
    {/if}
  </div>
</div>
