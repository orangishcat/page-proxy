<script lang="ts">
  import type { ElementInfo, SelectorSavePayload, SelectorSaveResult } from "@/lib/selection";
  import { onDestroy, onMount } from "svelte";
  import SelectorPopup from "./SelectorPopup.svelte";
  import CssInspector from "./CssInspector.svelte";
  import {
    attachPopupKeyboardOwnership,
    POPUP_BASE_FONT_SIZE_PX,
    POPUP_SHARED_STYLE,
  } from "./popup/container-shared";

  type PropertyItem = {
    key: string;
    label: string;
    value: string;
    rawValue: string | ElementInfo["boundingBox"];
    primary: boolean;
  };

  type PopupMode = "pp-api" | "css";

  type Props = {
    info: ElementInfo;
    propertyItems: PropertyItem[];
    targetElement: Element | null;
    onSave: (payload: SelectorSavePayload) => Promise<SelectorSaveResult>;
    onCancel: () => void;
    mode?: PopupMode;
  };

  let { info, propertyItems, targetElement, onSave, onCancel, mode = "pp-api" }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let position = $state({ top: 0, left: 0 });
  let direction = $state<"top" | "bottom" | "left" | "right" | "center">("right");
  let arrowOffset = $state({ left: "50%", top: "50%" });
  let visible = $state(false);
  let popupHidden = $state(false);
  let popupMode = $state<PopupMode>("pp-api");
  let baseSelector = $derived(info.selector);

  const updatePosition = () => {
    if (!containerEl || !targetElement?.isConnected) {
      visible = false;
      return;
    }

    const popupRect = containerEl.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const gap = 0.75 * POPUP_BASE_FONT_SIZE_PX;
    const arrowSize = 0.75 * POPUP_BASE_FONT_SIZE_PX;

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

    const candidate = ordered.filter((entry) => fits[entry.key]).sort((left, right) => right.space - left.space)[0];
    direction = candidate?.key || "center";

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

  const arrowClasses = $derived({
    top: "bottom-0 translate-y-1/2 -translate-x-1/2 border-t-0 border-l-0",
    bottom: "top-0 -translate-y-1/2 -translate-x-1/2 border-b-0 border-r-0",
    left: "right-0 translate-x-1/2 -translate-y-1/2 border-l-0 border-b-0",
    right: "left-0 -translate-x-1/2 -translate-y-1/2 border-r-0 border-t-0",
    center: "hidden",
  });

  let releaseKeyboardOwnership = () => {};

  const handlePopupVisibilityChange = (hidden: boolean) => {
    popupHidden = hidden;
  };

  const handleBaseSelectorChange = (nextSelector: string) => {
    const normalizedSelector = nextSelector.trim();
    if (!normalizedSelector) {
      return;
    }
    baseSelector = normalizedSelector;
  };

  onMount(() => {
    popupMode = mode;
    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { capture: true });
    window.addEventListener("resize", scheduleUpdate);
    releaseKeyboardOwnership = attachPopupKeyboardOwnership(containerEl);
  });

  onDestroy(() => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    window.removeEventListener("scroll", scheduleUpdate, { capture: true });
    window.removeEventListener("resize", scheduleUpdate);
    releaseKeyboardOwnership();
  });

  $effect(() => {
    if (targetElement) {
      scheduleUpdate();
    }
  });

  $effect(() => {
    if (popupMode !== "css") {
      popupHidden = false;
    }
  });
</script>

<div
  bind:this={containerEl}
  class="pp-no-select-tool fixed z-2147483646 pointer-events-auto"
  style="top: {position.top}px; left: {position.left}px; width: min(45.3125em, 92vw); height: min(28.0625em, 80vh); visibility: {visible &&
  !popupHidden
    ? 'visible'
    : 'hidden'};"
>
  {#if direction !== "center"}
    <div
      class="absolute w-3 h-3 bg-gray-950 border border-gray-800 rotate-45 {arrowClasses[direction]}"
      style={direction === "top" || direction === "bottom" ? `left: ${arrowOffset.left}` : `top: ${arrowOffset.top}`}
    ></div>
  {/if}

  <div
    class="flex flex-col w-full h-full overflow-hidden rounded-lg border border-gray-800 bg-gray-950 text-gray-100 font-sans text-sm shadow-2xl pp-content-ui-root"
    style={POPUP_SHARED_STYLE}
  >
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
        onchange={(event) => (popupMode = event.currentTarget.value as PopupMode)}
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

    <div class="flex-1 min-h-0 overflow-hidden">
      <div class={`h-full ${popupMode === "pp-api" ? "" : "hidden"}`}>
        <SelectorPopup
          {info}
          {propertyItems}
          {onSave}
          {onCancel}
          {baseSelector}
          active={popupMode === "pp-api"}
          onBaseSelectorChange={handleBaseSelectorChange}
          onVisibilityChange={handlePopupVisibilityChange}
        />
      </div>

      <div class={`h-full ${popupMode === "css" ? "" : "hidden"}`}>
        <CssInspector
          {info}
          {propertyItems}
          {targetElement}
          {onSave}
          {onCancel}
          {baseSelector}
          active={popupMode === "css"}
          onBaseSelectorChange={handleBaseSelectorChange}
          onVisibilityChange={handlePopupVisibilityChange}
        />
      </div>
    </div>
  </div>
</div>
