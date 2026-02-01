<script lang="ts">
  import type { ElementInfo, SelectorSavePayload } from "@/lib/selection";
  import SelectorPopup from "./SelectorPopup.svelte";
  import { onMount, onDestroy } from "svelte";

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
    onSave: (payload: SelectorSavePayload) => void;
    onCancel: () => void;
  };

  let { info, propertyItems, targetElement, onSave, onCancel }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let position = $state({ top: 0, left: 0 });
  let direction = $state<"top" | "bottom" | "left" | "right" | "center">("right");
  let arrowOffset = $state({ left: "50%", top: "50%" });
  let visible = $state(false);

  const updatePosition = () => {
    if (!containerEl || !targetElement?.isConnected) {
      visible = false;
      return;
    }

    const popupRect = containerEl.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const gap = 0.75 * rootFontSize;
    const arrowSize = 0.75 * rootFontSize;

    const spaces = {
      top: targetRect.top,
      bottom: window.innerHeight - targetRect.bottom,
      left: targetRect.left,
      right: window.innerWidth - targetRect.right,
    };

    const fits = {
      top: spaces.top >= popupRect.height + gap + arrowSize * 0.5,
      bottom: spaces.bottom >= popupRect.height + gap + arrowSize * 0.5,
      left: spaces.left >= popupRect.width + gap + arrowSize * 0.5,
      right: spaces.right >= popupRect.width + gap + arrowSize * 0.5,
    };

    const ordered = [
      { key: "top" as const, space: spaces.top },
      { key: "bottom" as const, space: spaces.bottom },
      { key: "left" as const, space: spaces.left },
      { key: "right" as const, space: spaces.right },
    ];

    const candidate = ordered.filter((e) => fits[e.key]).sort((a, b) => b.space - a.space)[0];
    direction = candidate?.key || "center";

    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

    let top = 0;
    let left = 0;

    if (direction === "top") {
      top = targetRect.top - popupRect.height - gap;
      left = targetRect.left + targetRect.width * 0.5 - popupRect.width * 0.5;
    } else if (direction === "bottom") {
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width * 0.5 - popupRect.width * 0.5;
    } else if (direction === "left") {
      top = targetRect.top + targetRect.height * 0.5 - popupRect.height * 0.5;
      left = targetRect.left - popupRect.width - gap;
    } else if (direction === "right") {
      top = targetRect.top + targetRect.height * 0.5 - popupRect.height * 0.5;
      left = targetRect.right + gap;
    } else {
      top = (window.innerHeight - popupRect.height) * 0.5;
      left = (window.innerWidth - popupRect.width) * 0.5;
    }

    const maxLeft = window.innerWidth - popupRect.width - gap;
    const maxTop = window.innerHeight - popupRect.height - gap;
    left = clamp(left, gap, Math.max(gap, maxLeft));
    top = clamp(top, gap, Math.max(gap, maxTop));

    position = { top, left };

    if (direction === "top" || direction === "bottom") {
      const targetCenter = targetRect.left + targetRect.width * 0.5;
      const arrowLeft = clamp(targetCenter - left - arrowSize * 0.5, gap, popupRect.width - gap - arrowSize);
      arrowOffset = { left: `${arrowLeft}px`, top: "50%" };
    } else if (direction === "left" || direction === "right") {
      const targetCenter = targetRect.top + targetRect.height * 0.5;
      const arrowTop = clamp(targetCenter - top - arrowSize * 0.5, gap, popupRect.height - gap - arrowSize);
      arrowOffset = { left: "50%", top: `${arrowTop}px` };
    }

    visible = true;
  };

  let frameId: number | null = null;
  const scheduleUpdate = () => {
    if (frameId !== null) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      updatePosition();
    });
  };

  onMount(() => {
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { capture: true });
    window.addEventListener("resize", scheduleUpdate);
  });

  onDestroy(() => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener("scroll", scheduleUpdate, { capture: true });
    window.removeEventListener("resize", scheduleUpdate);
  });

  $effect(() => {
    if (targetElement) scheduleUpdate();
  });

  const arrowClasses = $derived({
    top: "bottom-0 translate-y-1/2 -translate-x-1/2 border-t-0 border-l-0",
    bottom: "top-0 -translate-y-1/2 -translate-x-1/2 border-b-0 border-r-0",
    left: "right-0 translate-x-1/2 -translate-y-1/2 border-l-0 border-b-0",
    right: "left-0 -translate-x-1/2 -translate-y-1/2 border-r-0 border-t-0",
    center: "hidden",
  });
</script>

<div
  bind:this={containerEl}
  class="pp-no-select-tool fixed z-1500 w-[min(45.3125rem,92vw)] h-[min(28.0625rem,80vh)] pointer-events-auto"
  style="top: {position.top}px; left: {position.left}px; visibility: {visible ? 'visible' : 'hidden'};"
>
  <!-- Arrow -->
  {#if direction !== "center"}
    <div
      class="absolute w-3 h-3 bg-gray-950 border border-gray-800 rotate-45 {arrowClasses[direction]}"
      style={direction === "top" || direction === "bottom" ? `left: ${arrowOffset.left}` : `top: ${arrowOffset.top}`}
    ></div>
  {/if}
  <SelectorPopup {info} {propertyItems} {onSave} {onCancel} />
</div>
