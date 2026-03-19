<script lang="ts">
  import { asset } from "$app/paths";
  import { Navigation } from "lucide-svelte";
  import { onMount, tick } from "svelte";
  import {
    LANDING_HERO_ASSETS,
    LANDING_HERO_POINTS,
    LANDING_HERO_RECTS,
    LANDING_HERO_SCENE_MAP,
    LANDING_HERO_STATIC_FRAMES,
    LANDING_HERO_TIMINGS,
    type HeroPanelKey,
    type LandingHeroPoint,
    type LandingHeroRect,
    type LandingHeroSceneId,
  } from "$lib/components/landing/landing-demo-sequence";

  const pageImageSrc = {
    before: asset(LANDING_HERO_ASSETS.page.before),
    after: asset(LANDING_HERO_ASSETS.page.after),
  };

  const toolImageSrc = {
    "select-empty": asset(LANDING_HERO_ASSETS.tool["select-empty"]),
    "select-selected": asset(LANDING_HERO_ASSETS.tool["select-selected"]),
    record: asset(LANDING_HERO_ASSETS.tool.record),
  };

  const editorImageSrc = {
    empty: asset(LANDING_HERO_ASSETS.editor.empty),
    saved: asset(LANDING_HERO_ASSETS.editor.saved),
  };

  const overlayImageSrc = {
    menu: asset(LANDING_HERO_ASSETS.overlays.menu),
    popup: asset(LANDING_HERO_ASSETS.overlays.popup),
  };

  let sceneId = $state<LandingHeroSceneId>("initial");
  let isReducedMotion = $state(false);

  const scene = $derived(LANDING_HERO_SCENE_MAP[sceneId]);

  let rootEl: HTMLDivElement | null = null;
  let pagePanelEl: HTMLElement | null = null;
  let toolPanelEl: HTMLElement | null = null;
  let editorPanelEl: HTMLElement | null = null;
  let cursorEl: HTMLDivElement | null = null;
  let pulseEl: HTMLDivElement | null = null;

  const getPanelElement = (panelKey: HeroPanelKey) => {
    if (panelKey === "page") return pagePanelEl;
    if (panelKey === "tool") return toolPanelEl;
    return editorPanelEl;
  };

  const toPercent = (value: number) => `${value * 100}%`;

  const rectStyle = (rect: LandingHeroRect) =>
    `left:${toPercent(rect.x)};top:${toPercent(rect.y)};width:${toPercent(rect.width)};height:${toPercent(rect.height)};`;

  const imageLayerClasses = (visible: boolean) =>
    `absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-out ${
      visible ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[1.01]"
    }`;

  const getRootPoint = (point: LandingHeroPoint) => {
    const panelEl = getPanelElement(point.panelKey);
    if (!rootEl || !panelEl) {
      return { x: 0, y: 0 };
    }

    const rootRect = rootEl.getBoundingClientRect();
    const panelRect = panelEl.getBoundingClientRect();

    return {
      x: panelRect.left - rootRect.left + panelRect.width * point.x,
      y: panelRect.top - rootRect.top + panelRect.height * point.y,
    };
  };

  const setScene = (nextSceneId: LandingHeroSceneId) => {
    sceneId = nextSceneId;
  };

  const resetStaticFrame = () => {
    sceneId = isReducedMotion ? LANDING_HERO_STATIC_FRAMES.reducedMotion : "initial";
  };

  const buildPlayback = async () => {
    await tick();

    if (!rootEl || !cursorEl || !pulseEl) {
      return () => {};
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    isReducedMotion = reducedMotionQuery.matches;
    resetStaticFrame();

    if (isReducedMotion) {
      return () => {};
    }

    const { gsap } = await import("gsap");
    type GsapTimeline = ReturnType<typeof gsap.timeline>;

    const clickPulse = (point: LandingHeroPoint) => {
      if (!cursorEl || !pulseEl) {
        return;
      }

      const { x, y } = getRootPoint(point);

      gsap.killTweensOf(pulseEl);
      gsap.set(pulseEl, { x, y, opacity: 0.48, scale: 0.35 });
      gsap.to(pulseEl, {
        opacity: 0,
        scale: 2.05,
        duration: 0.38,
        ease: "power2.out",
      });
      gsap.to(cursorEl, {
        scale: 0.84,
        duration: LANDING_HERO_TIMINGS.click / 2,
        repeat: 1,
        yoyo: true,
        ease: "power1.inOut",
        overwrite: "auto",
      });
    };

    const moveCursor = (timeline: GsapTimeline, point: LandingHeroPoint, hold = 1) => {
      const nextPoint = getRootPoint(point);
      timeline.to(cursorEl, {
        x: nextPoint.x,
        y: nextPoint.y,
        duration: LANDING_HERO_TIMINGS.move * hold,
        ease: "power2.inOut",
      });
    };

    const addPause = (timeline: GsapTimeline, duration = LANDING_HERO_TIMINGS.settle) => {
      timeline.to({}, { duration });
    };

    let context: { revert: () => void } | null = null;

    context = gsap.context(() => {
      const startPoint = getRootPoint(LANDING_HERO_POINTS.cursorStart);

      gsap.set(cursorEl, {
        x: startPoint.x,
        y: startPoint.y,
        opacity: 1,
        scale: 1,
      });
      gsap.set(pulseEl, { opacity: 0, scale: 0.35 });

      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: LANDING_HERO_TIMINGS.loopDelay,
      });

      timeline.call(() => {
        setScene("initial");
        const origin = getRootPoint(LANDING_HERO_POINTS.cursorStart);
        gsap.set(cursorEl, { x: origin.x, y: origin.y, scale: 1 });
        gsap.set(pulseEl, { opacity: 0, scale: 0.35 });
      });

      moveCursor(timeline, LANDING_HERO_POINTS.selectTool, 0.95);
      addPause(timeline);
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.selectTool);
        setScene("select-tool");
      });

      moveCursor(timeline, LANDING_HERO_POINTS.sidebar);
      timeline.call(() => {
        setScene("sidebar-hover");
      });
      addPause(timeline);
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.sidebar);
        setScene("sidebar-selected");
      });

      moveCursor(timeline, LANDING_HERO_POINTS.menuButton, 0.9);
      addPause(timeline);
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.menuButton);
        setScene("menu-open");
      });

      moveCursor(timeline, LANDING_HERO_POINTS.deleteElement);
      addPause(timeline);
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.deleteElement);
        setScene("page-deleted");
      });

      moveCursor(timeline, LANDING_HERO_POINTS.recordTool, 0.95);
      addPause(timeline);
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.recordTool);
        setScene("record-tool");
      });

      moveCursor(timeline, LANDING_HERO_POINTS.recordConfirm);
      addPause(timeline);
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.recordConfirm);
        setScene("record-popup");
      });

      moveCursor(timeline, LANDING_HERO_POINTS.popupSave, 1.1);
      addPause(timeline);
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.popupSave);
        setScene("saved");
      });

      timeline.to({}, { duration: LANDING_HERO_TIMINGS.finalHold });
    }, rootEl);

    const onMotionChange = (event: MediaQueryListEvent) => {
      isReducedMotion = event.matches;
      resetStaticFrame();

      if (context) {
        context.revert();
      }
    };

    reducedMotionQuery.addEventListener("change", onMotionChange);

    return () => {
      reducedMotionQuery.removeEventListener("change", onMotionChange);
      context?.revert();
    };
  };

  onMount(() => {
    let cleanup = () => {};

    void buildPlayback().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      cleanup();
    };
  });
</script>

<div class="mx-auto flex w-full justify-center overflow-x-auto">
  <div
    bind:this={rootEl}
    class="relative grid w-full min-w-200 max-w-[90vw] grid-cols-[minmax(0,1.331fr)_minmax(0,0.415fr)] gap-0"
    data-demo-step={sceneId}
    data-testid="landing-demo"
  >
    <section
      bind:this={pagePanelEl}
      class="relative overflow-hidden bg-[#11110f]"
      style="aspect-ratio:2560 / 1926;"
      aria-label="Landing demo page"
    >
      <img
        class={imageLayerClasses(scene.pageFrame === "before")}
        src={pageImageSrc.before}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <img
        class={imageLayerClasses(scene.pageFrame === "after")}
        src={pageImageSrc.after}
        alt=""
        aria-hidden="true"
        draggable="false"
      />

      <div
        class={`absolute rounded-sm border-[0.16em] transition-all duration-300 ease-out ${
          scene.sidebarState === "hidden"
            ? "opacity-0"
            : scene.sidebarState === "hover"
              ? "border-[#91e046] shadow-[0_0_0_0.12em_rgba(145,224,70,0.22)]"
              : "border-[#91e046] shadow-[0_0_0_0.12em_rgba(145,224,70,0.35)]"
        }`}
        style={rectStyle(LANDING_HERO_RECTS.sidebar)}
      ></div>

      <div
        class={`absolute inset-0 bg-black/55 transition-opacity duration-400 ${
          scene.scrimVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      ></div>

      <img
        class={`absolute object-cover shadow-[0_1.6em_3.2em_-2em_rgba(0,0,0,0.6)] transition-all duration-500 ease-out ${
          scene.popupVisible ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[0.96]"
        }`}
        style={`${rectStyle(LANDING_HERO_RECTS.popup)} aspect-ratio:2144 / 1318;`}
        src={overlayImageSrc.popup}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
    </section>

    <div class="grid grid-rows-[600fr_1322fr] gap-0">
      <section
        bind:this={toolPanelEl}
        class="relative overflow-visible bg-[#24241f]"
        style="aspect-ratio:798 / 600;"
        aria-label="Landing demo tool panel"
      >
        <img
          class={imageLayerClasses(scene.toolFrame === "select-empty")}
          src={toolImageSrc["select-empty"]}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <img
          class={imageLayerClasses(scene.toolFrame === "select-selected")}
          src={toolImageSrc["select-selected"]}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <img
          class={imageLayerClasses(scene.toolFrame === "record")}
          src={toolImageSrc.record}
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        <img
          class={`absolute object-cover transition-all duration-300 ease-out ${
            scene.menuVisible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-[0.3em]"
          }`}
          style={`${rectStyle(LANDING_HERO_RECTS.menu)} aspect-ratio:448 / 356;`}
          src={overlayImageSrc.menu}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </section>

      <section
        bind:this={editorPanelEl}
        class="relative overflow-hidden bg-[#24241f]"
        style="aspect-ratio:798 / 1322;"
        aria-label="Landing demo code editor"
      >
        <img
          class={imageLayerClasses(scene.editorFrame === "empty")}
          src={editorImageSrc.empty}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <img
          class={imageLayerClasses(scene.editorFrame === "saved")}
          src={editorImageSrc.saved}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </section>
    </div>

    <div
      bind:this={pulseEl}
      class="pointer-events-none absolute left-0 top-0 z-20 h-[1.1em] w-[1.1em] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#a8ef52]/70 bg-[#9ee34a]/30 opacity-0"
    ></div>

    <div
      bind:this={cursorEl}
      class={`pointer-events-none absolute left-0 top-0 z-30 -translate-x-[0.7em] -translate-y-[0.38em] ${
        isReducedMotion ? "hidden" : "block"
      }`}
    >
      <Navigation class="h-[1.6em] w-[1.6em] -scale-x-100 fill-black text-white" strokeWidth={2.15} />
    </div>
  </div>
</div>
