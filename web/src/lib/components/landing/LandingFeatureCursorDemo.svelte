<script lang="ts">
  import { Navigation } from "lucide-svelte";
  import { onMount, tick } from "svelte";
  import { LANDING_HERO_TIMINGS } from "$lib/components/landing/landing-demo-sequence";
  import {
    addTimelinePause,
    getPointInRoot,
    moveTimelineTarget,
    setTargetPoint,
    tapCursor,
  } from "$lib/components/landing/landing-motion";

  type HoverTarget = "top" | "bottom";

  const cursorPoints = {
    top: { x: 0.79, y: 0.2 },
    bottom: { x: 0.32, y: 0.67 },
  } as const;

  const rectangleStyles = {
    top: "right: 12%; top: 14%; width: 18%; height: 12%;",
    bottom: "left: 16%; top: 58%; width: 40%; height: 18%;",
  } as const;

  const outlineStyles = {
    top: "right: 12%; top: 14%; width: 18%; height: 12%;",
    bottom: "left: 16%; top: 58%; width: 40%; height: 18%;",
  } as const;

  const tooltipStyles = {
    top: "right: 0; top: 5%;",
    bottom: "left: 10%; top: 82%;",
  } as const;

  let rootEl: HTMLDivElement | null = null;
  let cursorEl: HTMLDivElement | null = null;
  let topOutlineEl: HTMLDivElement | null = null;
  let bottomOutlineEl: HTMLDivElement | null = null;
  let topTooltipEl: HTMLDivElement | null = null;
  let bottomTooltipEl: HTMLDivElement | null = null;

  const buildPlayback = async () => {
    await tick();

    if (!rootEl || !cursorEl || !topOutlineEl || !bottomOutlineEl || !topTooltipEl || !bottomTooltipEl) {
      return () => {};
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { gsap } = await import("gsap");
    const topPoint = getPointInRoot(rootEl, rootEl, cursorPoints.top);
    const bottomPoint = getPointInRoot(rootEl, rootEl, cursorPoints.bottom);

    const setHoverTarget = (target: HoverTarget) => {
      gsap.set(topOutlineEl, { opacity: target === "top" ? 1 : 0 });
      gsap.set(bottomOutlineEl, { opacity: target === "bottom" ? 1 : 0 });
      gsap.set(topTooltipEl, { opacity: target === "top" ? 1 : 0, y: target === "top" ? 0 : 4 });
      gsap.set(bottomTooltipEl, { opacity: target === "bottom" ? 1 : 0, y: target === "bottom" ? 0 : 4 });
    };

    if (reducedMotionQuery.matches) {
      setTargetPoint(gsap, cursorEl, bottomPoint, { opacity: 1, scale: 1 });
      setHoverTarget("bottom");
      return () => {};
    }

    let context: { revert: () => void } | null = null;

    context = gsap.context(() => {
      setTargetPoint(gsap, cursorEl, topPoint, { opacity: 1, scale: 1 });
      setHoverTarget("top");

      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: LANDING_HERO_TIMINGS.loopDelay,
      });

      timeline.call(() => {
        setTargetPoint(gsap, cursorEl, topPoint, { scale: 1 });
        setHoverTarget("top");
      });
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.call(() => {
        tapCursor(gsap, cursorEl, LANDING_HERO_TIMINGS.click);
        setHoverTarget("top");
      });

      moveTimelineTarget(timeline, cursorEl, bottomPoint, LANDING_HERO_TIMINGS.move);
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.call(() => {
        tapCursor(gsap, cursorEl, LANDING_HERO_TIMINGS.click);
        setHoverTarget("bottom");
      });

      moveTimelineTarget(timeline, cursorEl, topPoint, LANDING_HERO_TIMINGS.move);
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle * 0.8);
    }, rootEl);

    return () => {
      context?.revert();
    };
  };

  onMount(() => {
    let cleanup = () => {};
    let rebuildToken = 0;
    let resizeFrame = 0;
    let lastObservedWidth = 0;
    let lastObservedHeight = 0;

    const rebuildPlayback = async () => {
      const nextToken = ++rebuildToken;

      cleanup();
      cleanup = () => {};

      const nextCleanup = await buildPlayback();
      if (nextToken !== rebuildToken) {
        nextCleanup();
        return;
      }

      cleanup = nextCleanup;
    };

    const schedulePlaybackRefresh = () => {
      if (resizeFrame !== 0) {
        return;
      }

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        void rebuildPlayback();
      });
    };

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      const { height, width } = entry.contentRect;
      if (lastObservedWidth === 0 && lastObservedHeight === 0) {
        lastObservedWidth = width;
        lastObservedHeight = height;
        return;
      }

      if (width === lastObservedWidth && height === lastObservedHeight) {
        return;
      }

      lastObservedWidth = width;
      lastObservedHeight = height;
      schedulePlaybackRefresh();
    });

    if (rootEl) {
      resizeObserver.observe(rootEl);
    }

    reducedMotionQuery.addEventListener("change", schedulePlaybackRefresh);
    window.addEventListener("resize", schedulePlaybackRefresh);
    void rebuildPlayback();

    return () => {
      rebuildToken += 1;
      window.cancelAnimationFrame(resizeFrame);
      reducedMotionQuery.removeEventListener("change", schedulePlaybackRefresh);
      window.removeEventListener("resize", schedulePlaybackRefresh);
      resizeObserver.disconnect();
      cleanup();
    };
  });
</script>

<div
  bind:this={rootEl}
  class="relative mx-auto w-full max-w-xl overflow-visible"
  style="aspect-ratio: 11 / 9;"
  aria-hidden="true"
>
  <div
    class="absolute border border-gray-200 bg-gray-300 dark:border-gray-500 dark:bg-gray-800 rounded-sm"
    style={rectangleStyles.top}
  ></div>
  <div
    class="absolute border border-gray-200 bg-gray-300 dark:border-gray-500 dark:bg-gray-800 rounded-sm"
    style={rectangleStyles.bottom}
  ></div>

  <div
    bind:this={topOutlineEl}
    class="absolute border-2 border-accent-500 opacity-0 dark:border-accent-400 rounded-sm"
    style={outlineStyles.top}
  ></div>
  <div
    bind:this={bottomOutlineEl}
    class="absolute border-2 border-accent-500 opacity-0 dark:border-accent-400 rounded-sm"
    style={outlineStyles.bottom}
  ></div>

  <div
    bind:this={topTooltipEl}
    class="absolute border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 opacity-0 whitespace-nowrap dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
    style={tooltipStyles.top}
  >
    div.top-right-rectangle.rounded-xl
  </div>
  <div
    bind:this={bottomTooltipEl}
    class="absolute border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 opacity-0 whitespace-nowrap dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
    style={tooltipStyles.bottom}
  >
    section.demo-card[data-preview]
  </div>

  <div bind:this={cursorEl} class="pointer-events-none absolute left-0 top-0 z-10 -translate-x-3 -translate-y-1">
    <Navigation class="h-12 w-12 -scale-x-100 fill-black text-white" />
  </div>
</div>
