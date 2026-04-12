<script lang="ts">
  import { CircleQuestionMark, Disc, MousePointer, Settings, Share } from "lucide-svelte";
  import Button from "@/lib/components/Button.svelte";
  import type { ToolId } from "./tools/state-storage";

  type Props = {
    activeTool: ToolId;
    showHelpButton: boolean;
    ontoolselect: (tool: ToolId) => void;
  };

  const { activeTool, showHelpButton, ontoolselect }: Props = $props();

  type ToolbarControlId = "select" | "selectors" | "record" | "settings" | "help" | "share";

  let hoveredTool = $state<ToolbarControlId | null>(null);
  let lastHoveredTool = $state<ToolbarControlId | null>(null);
  let isToolbarHovered = $state(false);

  const toolLabels: Record<ToolId, string> = {
    select: "Select",
    create: "Create",
    selectors: "Selectors",
    record: "Record",
    settings: "Settings",
    share: "Export",
    help: "Help",
    none: "",
  };

  const shortcutLabels: Partial<Record<ToolbarControlId, string>> = {
    select: "⇧1",
    selectors: "⇧2",
    record: "⇧3",
    settings: "⇧4",
    share: "⇧5",
  };

  const activeToolLabel = $derived(toolLabels[activeTool]);
  const hoverCandidate = $derived(hoveredTool ?? lastHoveredTool);
  const hoveredShortcutLabel = $derived(hoverCandidate ? shortcutLabels[hoverCandidate] ?? "" : "");
  const hoveredToolLabel = $derived(hoverCandidate ? toolLabels[hoverCandidate] : "");
  const hoveredToolText = $derived(
    hoverCandidate ? `${hoveredToolLabel}${hoveredShortcutLabel ? ` (${hoveredShortcutLabel})` : ""}` : "",
  );
  const showHoveredToolLabel = $derived(Boolean(isToolbarHovered && hoverCandidate));
  const toolLabelText = $derived(showHoveredToolLabel ? hoveredToolText : activeToolLabel);

  const toolButtonClasses = (selected: boolean) =>
    "w-8 h-8 !p-0 rounded-lg text-white dark:text-white " +
    (selected ? "bg-accent-500 hover:!opacity-100" : "bg-[#55503E] hover:opacity-55 active:opacity-40");
  const iconSize = "w-5 h-5";

  const onHover = (tool: ToolbarControlId) => {
    hoveredTool = tool;
    lastHoveredTool = tool;
  };
  const onLeave = () => {
    hoveredTool = null;
  };
</script>

<div
  class="flex justify-between h-12 px-3 py-2 bg-[#393a34]"
  role="toolbar"
  aria-label="Tool actions"
  tabindex="0"
  onmouseenter={() => { isToolbarHovered = true; }}
  onmouseleave={() => { isToolbarHovered = false; hoveredTool = null; lastHoveredTool = null; }}
>
  <div class="h-full min-w-0 flex flex-1 flex-row gap-3 place-items-center">
    <Button
      class={toolButtonClasses(activeTool === "select")}
      variant="outline"
      aria-label="Toggle selection mode"
      aria-pressed={activeTool === "select"}
      onmouseenter={() => onHover("select")}
      onmouseleave={onLeave}
      onclick={() => ontoolselect("select")}
    >
      <MousePointer class={iconSize} />
    </Button>
    <Button
      class="{toolButtonClasses(activeTool === 'selectors')} text-sm"
      variant="outline"
      aria-label="Selectors tool"
      onmouseenter={() => onHover("selectors")}
      onmouseleave={onLeave}
      onclick={() => ontoolselect("selectors")}
    >
      $0
    </Button>
    <Button
      class={toolButtonClasses(activeTool === "record")}
      variant="outline"
      aria-label="Record tool"
      onmouseenter={() => onHover("record")}
      onmouseleave={onLeave}
      onclick={() => ontoolselect("record")}
    >
      <Disc class={iconSize} />
    </Button>
    <span
      class="min-w-0 max-w-full flex-1 truncate transition duration-300 {showHoveredToolLabel
        ? 'text-gray-600 dark:text-gray-400'
        : ''}"
    >
      {toolLabelText}
    </span>
  </div>
  <div class="h-full flex flex-row gap-4 place-items-center">
    {#if showHelpButton}
      <Button
        class={toolButtonClasses(activeTool === "help")}
        variant="outline"
        aria-label="Help"
        onmouseenter={() => onHover("help")}
        onmouseleave={onLeave}
        onclick={() => ontoolselect("help")}
      >
        <CircleQuestionMark class={iconSize} />
      </Button>
    {/if}
    <Button
      class={toolButtonClasses(activeTool === "settings")}
      variant="outline"
      aria-label="Settings"
      onmouseenter={() => onHover("settings")}
      onmouseleave={onLeave}
      onclick={() => ontoolselect("settings")}
    >
      <Settings class={iconSize} />
    </Button>
    <Button
      class="{toolButtonClasses(activeTool === 'share')} bg-secondary-500"
      variant="outline"
      aria-label="Export tool"
      onmouseenter={() => onHover("share")}
      onmouseleave={onLeave}
      onclick={() => ontoolselect("share")}
    >
      <Share class={iconSize} />
    </Button>
  </div>
</div>
