<script lang="ts">
  import { CircleQuestionMark, Disc, MousePointer, Share } from "lucide-svelte";
  import Button from "$lib/components/Button.svelte";
  import type { LandingDemoToolId } from "$lib/components/landing/demo-playback";

  type Props = {
    activeTool: LandingDemoToolId;
    ontoolselect?: (tool: LandingDemoToolId) => void;
  };

  let { activeTool, ontoolselect = () => {} }: Props = $props();

  let hoveredTool = $state<LandingDemoToolId | null>(null);

  const toolLabels: Record<LandingDemoToolId, string> = {
    select: "Select",
    selectors: "Selectors",
    record: "Record",
    help: "Help",
    share: "Export",
  };

  const visibleLabel = $derived(toolLabels[hoveredTool ?? activeTool]);
  const iconSize = "h-5 w-5";

  const baseToolButton = "h-8! w-8! rounded-lg p-0! text-white! transition hover:opacity-70 active:opacity-50";
  const toolButtonClasses = (selected: boolean, accent = false) =>
    `${baseToolButton} ${accent ? "bg-secondary-500!" : selected ? "bg-accent-500!" : "bg-[#55503e]!"}`;
</script>

<div
  class="flex h-12 items-center justify-between bg-[#393a34] px-3 py-2"
  role="toolbar"
  aria-label="Tool actions"
>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <Button
      class={toolButtonClasses(activeTool === "select")}
      variant="outline"
      aria-label="Select tool"
      aria-pressed={activeTool === "select"}
      onmouseenter={() => {
        hoveredTool = "select";
      }}
      onmouseleave={() => {
        hoveredTool = null;
      }}
      onclick={() => {
        ontoolselect("select");
      }}
    >
      <MousePointer class={iconSize} />
    </Button>

    <Button
      class={`${toolButtonClasses(activeTool === "selectors")} text-sm`}
      variant="outline"
      aria-label="Selectors tool"
      aria-pressed={activeTool === "selectors"}
      onmouseenter={() => {
        hoveredTool = "selectors";
      }}
      onmouseleave={() => {
        hoveredTool = null;
      }}
      onclick={() => {
        ontoolselect("selectors");
      }}
    >
      $0
    </Button>

    <Button
      class={toolButtonClasses(activeTool === "record")}
      variant="outline"
      aria-label="Record tool"
      aria-pressed={activeTool === "record"}
      onmouseenter={() => {
        hoveredTool = "record";
      }}
      onmouseleave={() => {
        hoveredTool = null;
      }}
      onclick={() => {
        ontoolselect("record");
      }}
    >
      <Disc class={iconSize} />
    </Button>

    <span class="min-w-0 flex-1 truncate text-sm text-gray-100 transition-colors duration-200">
      {visibleLabel}
    </span>
  </div>

  <div class="flex items-center gap-3.5">
    <Button
      class={toolButtonClasses(activeTool === "help")}
      variant="outline"
      aria-label="Help tool"
      aria-pressed={activeTool === "help"}
      onmouseenter={() => {
        hoveredTool = "help";
      }}
      onmouseleave={() => {
        hoveredTool = null;
      }}
      onclick={() => {
        ontoolselect("help");
      }}
    >
      <CircleQuestionMark class={iconSize} />
    </Button>

    <Button
      class={toolButtonClasses(activeTool === "share", true)}
      variant="outline"
      aria-label="Export tool"
      aria-pressed={activeTool === "share"}
      onmouseenter={() => {
        hoveredTool = "share";
      }}
      onmouseleave={() => {
        hoveredTool = null;
      }}
      onclick={() => {
        ontoolselect("share");
      }}
    >
      <Share class={iconSize} />
    </Button>
  </div>
</div>
