<script lang="ts">
  import { Navigation } from "lucide-svelte";
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import CodeEditorMock, {
    type CodeLine,
    type CodeToken,
    type TokenTone,
  } from "$lib/components/landing/CodeEditorMock.svelte";
  import {
    activateLandingDemoTool,
    advanceLandingDemoPlayback,
    createLandingDemoPlayback,
    getLandingDemoStep,
    type LandingDemoStepMap,
  } from "$lib/components/landing/demo-playback";
  import LandingDemoToolbar from "$lib/components/landing/LandingDemoToolbar.svelte";

  type RecordDemoStep =
    | "recording"
    | "selected"
    | "converting"
    | "converted"
    | "select-panel"
    | "selectors-panel"
    | "help-panel"
    | "share-panel";

  type TimelineEntry = {
    id: string;
    action: string;
    detail: string;
    timestamp: string;
  };

  const recordDemoSteps = {
    select: ["select-panel"],
    selectors: ["selectors-panel"],
    record: ["recording", "selected", "converting", "converted"],
    help: ["help-panel"],
    share: ["share-panel"],
  } satisfies LandingDemoStepMap<RecordDemoStep>;

  const timelineEntries: TimelineEntry[] = [
    { id: "selected-element", action: "Selected element", detail: ".semicircle-top-right", timestamp: "10:42:10" },
    { id: "clicked-element", action: "Clicked element", detail: "Open details", timestamp: "10:42:11" },
    { id: "selected-button", action: "Selected element", detail: ".cta-card button", timestamp: "10:42:12" },
    { id: "clicked-button", action: "Clicked element", detail: "Join waitlist", timestamp: "10:42:13" },
  ];

  const token = (text: string, tone: TokenTone = "plain"): CodeToken => ({ text, tone });
  const line = (id: string, tokens: CodeToken[]): CodeLine => ({ id, tokens });

  const baseEditorLines: CodeLine[] = [
    line("import-pq", [
      token("import", "keyword"),
      token(" * as "),
      token("pq", "type"),
      token(" from "),
      token('"@page-proxy/pp/pp-query"', "string"),
      token(";"),
    ]),
    line("import-pv", [
      token("import", "keyword"),
      token(" * as "),
      token("pv", "type"),
      token(" from "),
      token('"@page-proxy/pp/pp-event"', "string"),
      token(";"),
    ]),
    line("meta-gap", []),
    line("record-note", [token("// Record actions to turn them into code", "comment")]),
  ];

  const convertingEditorLines: CodeLine[] = [
    ...baseEditorLines,
    line("converting-gap", []),
    line("converting-line", [token("// Converting 4 actions into Page Proxy calls…", "comment")]),
  ];

  const convertedEditorLines: CodeLine[] = [
    line("import-pq", [
      token("import", "keyword"),
      token(" * as "),
      token("pq", "type"),
      token(" from "),
      token('"@page-proxy/pp/pp-query"', "string"),
      token(";"),
    ]),
    line("import-pv", [
      token("import", "keyword"),
      token(" * as "),
      token("pv", "type"),
      token(" from "),
      token('"@page-proxy/pp/pp-event"', "string"),
      token(";"),
    ]),
    line("record-gap", []),
    line("selected-hero", [
      token("const", "keyword"),
      token(" heroArc = "),
      token("pq", "type"),
      token("."),
      token("selector", "function"),
      token("("),
      token('".semicircle-top-right"', "string"),
      token(");"),
    ]),
    line("selected-cta", [
      token("const", "keyword"),
      token(" waitlistButton = "),
      token("pq", "type"),
      token("."),
      token("selector", "function"),
      token("("),
      token('".cta-card button"', "string"),
      token(");"),
    ]),
    line("click-cta", [
      token("pv", "type"),
      token("."),
      token("click", "function"),
      token("("),
      token("waitlistButton"),
      token(");"),
    ]),
    line("notify", [
      token("pv", "type"),
      token("."),
      token("notification", "function"),
      token("("),
      token('"Waitlist flow replay ready."', "string"),
      token(");"),
    ]),
  ];

  let playback = $state(createLandingDemoPlayback("record"));

  const currentStep = $derived(getLandingDemoStep(recordDemoSteps, playback));
  const isRecordTool = $derived(playback.activeTool === "record");
  const visibleEntryCount = $derived.by(() => {
    if (currentStep === "recording") {
      return 2;
    }

    if (currentStep === "selected") {
      return 4;
    }

    if (currentStep === "converting" || currentStep === "converted") {
      return 4;
    }

    return 0;
  });

  const visibleEntries = $derived(timelineEntries.slice(0, visibleEntryCount));
  const selectedEntryIds = $derived(
    currentStep === "selected" || currentStep === "converting" || currentStep === "converted"
      ? ["selected-element", "clicked-element", "selected-button", "clicked-button"]
      : [],
  );
  const selectedEntryIdSet = $derived(new Set(selectedEntryIds));

  const convertButtonLabel = $derived(currentStep === "converting" ? "Converting..." : "Convert to code");

  const editorLines = $derived.by(() => {
    if (playback.activeTool === "select") {
      return [
        ...baseEditorLines,
        line("select-note", [token("// Select an element to inspect its properties", "comment")]),
      ];
    }

    if (playback.activeTool === "selectors") {
      return [
        ...baseEditorLines,
        line("selectors-note", [token("// Reuse saved selectors across the script", "comment")]),
      ];
    }

    if (playback.activeTool === "help") {
      return [...baseEditorLines, line("help-note", [token("// Record starts with a selected element", "comment")])];
    }

    if (playback.activeTool === "share") {
      return [
        ...baseEditorLines,
        line("share-note", [token("// Export the generated script once it looks right", "comment")]),
      ];
    }

    if (currentStep === "converted") {
      return convertedEditorLines;
    }

    if (currentStep === "converting") {
      return convertingEditorLines;
    }

    return baseEditorLines;
  });

  const highlightedLineIds = $derived(
    currentStep === "converted" ? ["selected-hero", "selected-cta", "click-cta", "notify"] : [],
  );

  const cursorTransform = $derived.by(() => {
    if (playback.activeTool !== "record") {
      return "translate(38em, 21em) scale(0.94)";
    }

    if (currentStep === "recording") {
      return "translate(23.8em, 10em) scale(1)";
    }

    if (currentStep === "selected") {
      return "translate(17.8em, 19.4em) scale(1)";
    }

    return "translate(17.8em, 19.4em) scale(0.92)";
  });

  const handleToolSelect = (tool: keyof typeof recordDemoSteps) => {
    playback = activateLandingDemoTool(playback, tool);
  };

  onMount(() => {
    const interval = window.setInterval(() => {
      playback = advanceLandingDemoPlayback(playback, recordDemoSteps);
    }, 1300);

    return () => {
      window.clearInterval(interval);
    };
  });
</script>

<div class="relative flex h-138 w-full overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
  <section
    class="relative h-full flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,#30322e_0%,#1f211f_55%,#171816_100%)]"
  >
    <div
      class="absolute left-16.5 top-55.5 h-23 w-23 rounded-full border-2 border-gray-500 bg-gray-600 transition-all duration-300"
    ></div>
    <div
      class="absolute left-52.5 top-54.5 h-27 w-11 rounded border-2 border-gray-500 bg-gray-600 transition-all duration-300"
    ></div>
    <div
      class="absolute left-87.5 top-57.5 h-18 w-24 bg-gray-500 transition-all duration-300 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]"
    >
      <div class="absolute inset-px bg-gray-600 [clip-path:polygon(50%_0%,0%_100%,100%_100%)]"></div>
    </div>
    <div
      class="absolute left-49.5 top-29.25 h-20 w-20 rounded border-2 border-gray-500 bg-gray-600 transition-all duration-300"
    ></div>

    <div
      class="cta-card absolute bottom-12.5 left-53.5 h-35 w-48 rounded-[1.5em] border-2 border-gray-500 bg-gray-600 transition-all duration-300"
    ></div>
    <div
      class={`absolute bottom-[4.8em] left-[17.1em] flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-all duration-300 ${
        currentStep === "selected" || currentStep === "converting" || currentStep === "converted"
          ? "border-accent-500 bg-accent-500/15 text-accent-500 shadow-[0_0_0_0.3em_rgba(187,147,72,0.18)]"
          : "border-gray-500 bg-gray-900 text-gray-200"
      }`}
    >
      Join waitlist
    </div>

    <div
      class={`absolute left-[23.1em] top-[7.6em] h-16 w-32 rounded-t-full border-2 bg-gray-600 transition-all duration-300 ${
        currentStep === "recording" ||
        currentStep === "selected" ||
        currentStep === "converting" ||
        currentStep === "converted"
          ? "border-accent-500 shadow-[0_0_0_0.35em_rgba(187,147,72,0.2)]"
          : "border-gray-500"
      }`}
    ></div>

    {#if isRecordTool}
      <div class="absolute left-0 top-0 z-20 p-1 transition-all duration-500" style={`transform:${cursorTransform};`}>
        <Navigation class="h-6 w-6 -scale-x-100 fill-gray-950 text-gray-100" strokeWidth={2.1} />
      </div>
    {/if}

    {#if currentStep === "selected" || currentStep === "converting" || currentStep === "converted"}
      <div
        class="absolute left-[15.7em] top-[19.8em] h-5 w-5 rounded-full border border-accent-500/50 bg-accent-500/15"
      ></div>
    {/if}
  </section>

  <aside class="flex h-full w-2/5 min-w-85 flex-col border-l border-gray-800 bg-gray-950">
    <section class="flex w-full shrink-0 flex-col bg-gray-900" aria-label="Tool panel">
      <LandingDemoToolbar activeTool={playback.activeTool} ontoolselect={handleToolSelect} />

      <div class="flex h-62 min-h-0 flex-col px-4 py-4">
        {#if playback.activeTool === "record"}
          <div class="mb-3 flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-3 py-2">
            <div>
              <div class="text-xs uppercase tracking-[0.18em] text-gray-500">Record panel</div>
              <div class="mt-1 flex items-center gap-2 text-sm text-gray-100">
                <span class={`h-2 w-2 rounded-full ${currentStep === "recording" ? "bg-red-400" : "bg-accent-500"}`}></span>
                <span>{currentStep === "recording" ? "Capturing live actions" : "Selection ready to convert"}</span>
              </div>
            </div>

            <span class="rounded-full border border-gray-700 px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-gray-500">
              {visibleEntries.length} events
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto pr-1">
            {#if visibleEntries.length === 0}
              <div class="flex h-full items-center justify-center text-xs text-gray-500">
                Recording is paused for this tab
              </div>
            {:else}
              <ul class="space-y-2">
                {#each visibleEntries as entry (entry.id)}
                  <li>
                    <button
                      class={`w-full rounded-xl border px-2 py-2 text-left transition ${
                        selectedEntryIdSet.has(entry.id)
                          ? "border-accent-500/40 bg-accent-500/10"
                          : "border-transparent bg-transparent hover:border-accent-500/20 hover:bg-accent-500/8"
                      }`}
                      type="button"
                      aria-pressed={selectedEntryIdSet.has(entry.id)}
                    >
                      <div class="flex items-start justify-between gap-3">
                        <span class="min-w-0 text-sm text-gray-100">{entry.action}</span>
                        <span class="shrink-0 text-[0.7rem] text-gray-500">{entry.timestamp}</span>
                      </div>
                      <p class="mt-1 truncate font-mono text-[0.72rem] text-gray-400">{entry.detail}</p>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>

          <div class="mt-4 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <span class="text-xs text-gray-500">
              {selectedEntryIds.length > 0 ? `${selectedEntryIds.length} selected` : "Recording live"}
            </span>
            <Button
              class={`w-full max-w-40 justify-self-center text-sm ${currentStep === "converting" ? "animate-pulse" : ""}`}
              variant="primary"
              disabled={currentStep === "recording"}
            >
              {convertButtonLabel}
            </Button>
            <div class="flex justify-end">
              <span
                class="rounded-full border border-gray-700 px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-gray-500"
              >
                {currentStep === "converted" ? "Generated" : "Timeline"}
              </span>
            </div>
          </div>

          {#if currentStep === "converted"}
            <div class="mt-3 rounded-xl border border-accent-500/20 bg-accent-500/10 px-3 py-2 text-xs text-accent-500">
              Recorded actions converted into reusable code.
            </div>
          {/if}
        {:else if playback.activeTool === "select"}
          <div class="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4 text-sm text-gray-200">
            <div class="font-semibold text-gray-100">Select before you record.</div>
            <p class="mt-2 text-xs leading-5 text-gray-400">
              Recording works best when the sequence starts with a concrete element selection.
            </p>
          </div>
        {:else if playback.activeTool === "selectors"}
          <div class="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4 text-sm text-gray-200">
            <div class="font-semibold text-gray-100">Saved selectors stay reusable</div>
            <p class="mt-2 text-xs leading-5 text-gray-400">
              Promote recorded targets into stable selector definitions when you want durable code.
            </p>
          </div>
        {:else if playback.activeTool === "help"}
          <div class="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4 text-sm text-gray-200">
            <div class="font-semibold text-gray-100">Record tips</div>
            <ul class="mt-3 space-y-2 text-xs text-gray-400">
              <li>Start with `Selected element`.</li>
              <li>Capture the shortest useful flow.</li>
              <li>Convert only the actions you want to keep.</li>
            </ul>
          </div>
        {:else}
          <div class="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4 text-sm text-gray-200">
            <div class="font-semibold text-gray-100">Export when the generated snippet is clean</div>
            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span class="rounded-full border border-gray-700 px-2 py-1 text-gray-300">PP script</span>
              <span class="rounded-full border border-gray-700 px-2 py-1 text-gray-300">Tampermonkey</span>
              <span class="rounded-full border border-gray-700 px-2 py-1 text-gray-300">CSS only</span>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <div class="h-2 w-full shrink-0 bg-gray-900"></div>

    <CodeEditorMock
      codeLines={editorLines}
      {highlightedLineIds}
      notificationMessage="Recorded flow converted into Page Proxy calls."
      showNotification={currentStep === "converted" && playback.activeTool === "record"}
      websiteText="localhost:5173/*"
    />
  </aside>
</div>
