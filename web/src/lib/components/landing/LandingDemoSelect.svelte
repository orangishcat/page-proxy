<script lang="ts">
  import { asset } from "$app/paths";
  import { Disc, MousePointerIcon, Navigation, Paintbrush, Save } from "lucide-svelte";
  import { onMount, tick } from "svelte";
  import {
    LANDING_HERO_ASSETS,
    LANDING_HERO_POINTS,
    LANDING_HERO_RECTS,
    LANDING_HERO_SCENE_MAP,
    LANDING_HERO_SCENE_IDS,
    LANDING_HERO_SECTIONS,
    LANDING_HERO_STATIC_FRAMES,
    LANDING_HERO_TIMINGS,
    type HeroPanelKey,
    type LandingHeroPoint,
    type LandingHeroRect,
    type LandingHeroSectionId,
    type LandingHeroSceneId,
  } from "$lib/components/landing/landing-demo-sequence";
  import {
    addTimelinePause,
    getPointInRoot,
    moveTimelineTarget,
    setTargetPoint,
    tapCursor,
    type PlaybackTimeline,
  } from "$lib/components/landing/landing-motion";

  type PlaybackSnapshot = {
    paused: boolean;
    sceneId: LandingHeroSceneId;
    time: number;
  };

  const heroTabs = [
    { id: "select", label: "Select" },
    { id: "apply-style", label: "Apply style" },
    { id: "record", label: "Record" },
    { id: "save-code", label: "Save code" },
  ] as const satisfies readonly { id: LandingHeroSectionId; label: string }[];

  const pageImageSrc = {
    before: asset(LANDING_HERO_ASSETS.page.before),
    after: asset(LANDING_HERO_ASSETS.page.after),
  };

  const toolImageSrc = {
    "select-empty": asset(LANDING_HERO_ASSETS.tool["select-empty"]),
    "select-selected": asset(LANDING_HERO_ASSETS.tool["select-selected"]),
    record: asset(LANDING_HERO_ASSETS.tool.record),
    "record-selected": asset(LANDING_HERO_ASSETS.tool["record-selected"]),
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
  let sceneOverrideId = $state<LandingHeroSceneId | null>(null);
  let isReducedMotion = $state(false);

  const visibleSceneId = $derived(sceneOverrideId ?? sceneId);
  const scene = $derived(LANDING_HERO_SCENE_MAP[visibleSceneId]);

  let rootEl: HTMLDivElement | null = null;
  let pagePanelEl: HTMLElement | null = null;
  let toolPanelEl: HTMLElement | null = null;
  let editorPanelEl: HTMLElement | null = null;
  let cursorEl: HTMLDivElement | null = null;
  let pulseEl: HTMLDivElement | null = null;
  let playbackTimeline: PlaybackTimeline | null = null;
  let activeSectionId = $state<LandingHeroSectionId>("select");
  let activeSectionProgress = $state(0);
  let resumePlaybackTimeout = 0;
  let pendingSectionId = $state<LandingHeroSectionId | null>(null);
  let isPlaybackReady = $state(false);

  const getSection = (sectionId: LandingHeroSectionId) => LANDING_HERO_SECTIONS.find((entry) => entry.id === sectionId);
  const getSectionStartSceneId = (sectionId: LandingHeroSectionId | null) => {
    if (!sectionId) {
      return null;
    }

    return getSection(sectionId)?.startSceneId ?? null;
  };

  const getPanelElement = (panelKey: HeroPanelKey) => {
    if (panelKey === "page") return pagePanelEl;
    if (panelKey === "tool") return toolPanelEl;
    return editorPanelEl;
  };

  const toPercent = (value: number) => `${value * 100}%`;

  const rectStyle = (rect: LandingHeroRect) =>
    `left:${toPercent(rect.x)};top:${toPercent(rect.y)};width:${toPercent(rect.width)};height:${toPercent(rect.height)};`;

  const imageLayerClasses = (visible: boolean) =>
    `absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out ${
      visible ? "opacity-100" : "pointer-events-none opacity-0"
    }`;

  const getRootPoint = (point: LandingHeroPoint) => {
    return getPointInRoot(rootEl, getPanelElement(point.panelKey), point);
  };

  const setScene = (nextSceneId: LandingHeroSceneId) => {
    sceneId = nextSceneId;
  };

  const resetStaticFrame = () => {
    sceneOverrideId = null;
    sceneId =
      getSectionStartSceneId(pendingSectionId) ??
      (isReducedMotion ? LANDING_HERO_STATIC_FRAMES.reducedMotion : "initial");
  };

  const tabProgress = $derived.by(() => {
    return heroTabs.map((tab) => {
      return {
        ...tab,
        isActive: tab.id === activeSectionId,
        progress: tab.id === activeSectionId ? activeSectionProgress : 0,
      };
    });
  });

  const tabBackgroundStyle = (isActive: boolean, progress: number) => {
    const stop = `${Math.max(0, Math.min(1, progress)) * 100}%`;

    if (!isActive) {
      return "background: rgba(63, 61, 56, 0.2);";
    }

    return `background: linear-gradient(90deg, rgba(146, 223, 70, 0.24) 0%, rgba(146, 223, 70, 0.12) ${stop}, rgba(63, 61, 56, 0.92) ${stop}, rgba(63, 61, 56, 0.92) 100%);`;
  };

  const updateSectionPlayback = (currentTime: number, labels: Record<string, number>, duration: number) => {
    const sectionTimes = LANDING_HERO_SECTIONS.map((section, index) => {
      const start = labels[section.startSceneId] ?? 0;
      const nextStart = LANDING_HERO_SECTIONS[index + 1]?.startSceneId;
      const end = nextStart ? (labels[nextStart] ?? duration) : duration;

      return {
        ...section,
        end,
        start,
      };
    });

    const currentSection =
      sectionTimes.find((section) => currentTime >= section.start && currentTime < section.end) ??
      sectionTimes.at(-1) ??
      sectionTimes[0];

    const span = Math.max(0.001, currentSection.end - currentSection.start);
    activeSectionId = currentSection.id;
    activeSectionProgress = Math.min(1, Math.max(0, (currentTime - currentSection.start) / span));
  };

  const getSceneAtTime = (currentTime: number, labels: Record<string, number>, duration: number) => {
    const sceneTimes = LANDING_HERO_SCENE_IDS.map((sceneId) => ({
      sceneId,
      start: labels[sceneId] ?? duration,
    }))
      .filter((scene) => scene.start <= duration)
      .sort((left, right) => left.start - right.start);

    return sceneTimes.findLast((scene) => currentTime >= scene.start)?.sceneId ?? sceneTimes[0]?.sceneId ?? "initial";
  };

  const getPlaybackSnapshot = (): PlaybackSnapshot | null => {
    if (isReducedMotion || !playbackTimeline) {
      return null;
    }

    return {
      paused: playbackTimeline.paused(),
      sceneId,
      time: playbackTimeline.time(),
    };
  };

  const jumpToSection = (sectionId: LandingHeroSectionId) => {
    const section = getSection(sectionId);
    if (!section) {
      return;
    }

    pendingSectionId = sectionId;
    sceneOverrideId = section.startSceneId;
    sceneId = section.startSceneId;
    activeSectionId = sectionId;
    activeSectionProgress = 0;

    if (isReducedMotion || !playbackTimeline) {
      return;
    }

    window.clearTimeout(resumePlaybackTimeout);
    playbackTimeline.pause();
    playbackTimeline.seek(section.startSceneId, true);
    setScene(section.startSceneId);
    updateSectionPlayback(playbackTimeline.time(), playbackTimeline.labels, playbackTimeline.duration());

    resumePlaybackTimeout = window.setTimeout(() => {
      sceneOverrideId = null;
      pendingSectionId = null;
      playbackTimeline?.play();
    }, 220);
  };

  const buildPlayback = async (snapshot: PlaybackSnapshot | null = null) => {
    await tick();

    if (!rootEl || !cursorEl || !pulseEl) {
      return () => {};
    }

    isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resetStaticFrame();

    if (isReducedMotion) {
      isPlaybackReady = true;
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
      tapCursor(gsap, cursorEl, LANDING_HERO_TIMINGS.click);
    };

    let context: { revert: () => void } | null = null;

    context = gsap.context(() => {
      const startPoint = getRootPoint(LANDING_HERO_POINTS.cursorStart);

      setTargetPoint(gsap, cursorEl, startPoint, { opacity: 1, scale: 1 });
      gsap.set(pulseEl, { opacity: 0, scale: 0.35 });

      let timeline: GsapTimeline;

      timeline = gsap.timeline({
        onUpdate: () => {
          updateSectionPlayback(timeline.time(), timeline.labels, timeline.duration());
        },
        repeat: -1,
        repeatDelay: LANDING_HERO_TIMINGS.loopDelay,
      });
      playbackTimeline = timeline;

      timeline.addLabel("initial");
      timeline.call(() => {
        setScene("initial");
        const origin = getRootPoint(LANDING_HERO_POINTS.cursorStart);
        setTargetPoint(gsap, cursorEl, origin, { scale: 1 });
        gsap.set(pulseEl, { opacity: 0, scale: 0.35 });
      });

      moveTimelineTarget(
        timeline,
        cursorEl,
        getRootPoint(LANDING_HERO_POINTS.selectTool),
        LANDING_HERO_TIMINGS.move,
        0.95,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("select-tool");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.selectTool);
        setScene("select-tool");
      });

      moveTimelineTarget(timeline, cursorEl, getRootPoint(LANDING_HERO_POINTS.sidebar), LANDING_HERO_TIMINGS.move);
      timeline.addLabel("sidebar-hover");
      timeline.call(() => {
        setScene("sidebar-hover");
      });
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("sidebar-selected");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.sidebar);
        setScene("sidebar-selected");
      });

      moveTimelineTarget(
        timeline,
        cursorEl,
        getRootPoint(LANDING_HERO_POINTS.menuButton),
        LANDING_HERO_TIMINGS.move,
        0.9,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("menu-open");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.menuButton);
        setScene("menu-open");
      });

      moveTimelineTarget(
        timeline,
        cursorEl,
        getRootPoint(LANDING_HERO_POINTS.deleteElement),
        LANDING_HERO_TIMINGS.move,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("page-deleted");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.deleteElement);
        setScene("page-deleted");
      });

      moveTimelineTarget(
        timeline,
        cursorEl,
        getRootPoint(LANDING_HERO_POINTS.recordTool),
        LANDING_HERO_TIMINGS.move,
        0.95,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("record-tool");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.recordTool);
        setScene("record-tool");
      });

      moveTimelineTarget(
        timeline,
        cursorEl,
        getRootPoint(LANDING_HERO_POINTS.recordConfirm),
        LANDING_HERO_TIMINGS.move,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("record-selected");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.recordConfirm);
        setScene("record-selected");
      });

      moveTimelineTarget(timeline, cursorEl, getRootPoint(LANDING_HERO_POINTS.convertCode), LANDING_HERO_TIMINGS.move);
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("convert-code");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.convertCode);
        setScene("convert-code");
      });

      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle * 0.8);
      timeline.addLabel("record-popup");
      timeline.call(() => {
        setScene("record-popup");
      });

      moveTimelineTarget(
        timeline,
        cursorEl,
        getRootPoint(LANDING_HERO_POINTS.popupSave),
        LANDING_HERO_TIMINGS.move,
        1.1,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("saved");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.popupSave);
        setScene("saved");
      });

      timeline.to({}, { duration: LANDING_HERO_TIMINGS.finalHold });

      if (snapshot) {
        timeline.pause();
        timeline.seek(snapshot.time, true);
        setScene(getSceneAtTime(snapshot.time, timeline.labels, timeline.duration()) ?? snapshot.sceneId);
        sceneOverrideId = null;
        pendingSectionId = null;
        updateSectionPlayback(timeline.time(), timeline.labels, timeline.duration());

        if (!snapshot.paused) {
          timeline.play();
        }
      } else {
        const initialSectionSceneId = getSectionStartSceneId(pendingSectionId);
        if (initialSectionSceneId) {
          timeline.pause();
          timeline.seek(initialSectionSceneId, true);
          setScene(initialSectionSceneId);
          sceneOverrideId = initialSectionSceneId;
          updateSectionPlayback(timeline.time(), timeline.labels, timeline.duration());
          resumePlaybackTimeout = window.setTimeout(() => {
            sceneOverrideId = null;
            pendingSectionId = null;
            timeline.play();
          }, 220);
        } else {
          updateSectionPlayback(0, timeline.labels, timeline.duration());
        }
      }

      isPlaybackReady = true;
    }, rootEl);

    return () => {
      isPlaybackReady = false;
      playbackTimeline = null;
      window.clearTimeout(resumePlaybackTimeout);
      sceneOverrideId = null;
      context?.revert();
    };
  };

  onMount(() => {
    let cleanup = () => {};
    let rebuildToken = 0;
    let resizeFrame = 0;
    let lastObservedWidth = 0;
    let lastObservedHeight = 0;

    const rebuildPlayback = async (preserveState: boolean) => {
      const nextToken = ++rebuildToken;
      const snapshot = preserveState ? getPlaybackSnapshot() : null;

      cleanup();
      cleanup = () => {};

      const nextCleanup = await buildPlayback(snapshot);
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
        void rebuildPlayback(true);
      });
    };

    const onMotionChange = () => {
      void rebuildPlayback(true);
    };

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

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (rootEl) {
      resizeObserver.observe(rootEl);
    }

    window.addEventListener("resize", schedulePlaybackRefresh);
    reducedMotionQuery.addEventListener("change", onMotionChange);

    void rebuildPlayback(false);

    return () => {
      rebuildToken += 1;
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", schedulePlaybackRefresh);
      reducedMotionQuery.removeEventListener("change", onMotionChange);
      resizeObserver.disconnect();
      cleanup();
    };
  });
</script>

<div class="mx-auto flex w-full justify-center overflow-x-auto">
  <div class="flex w-full min-w-200 max-w-[72vw] px-4 flex-col items-center">
    <div
      bind:this={rootEl}
      class="relative grid w-full grid-cols-[minmax(0,1.331fr)_minmax(0,0.415fr)] gap-0 border rounded-lg border-gray-200 dark:border-gray-800"
      data-demo-ready={isPlaybackReady ? "true" : "false"}
      data-demo-step={visibleSceneId}
      data-testid="landing-demo"
    >
      <section
        bind:this={pagePanelEl}
        class="relative rounded-l-lg overflow-hidden"
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
          class={`absolute rounded-sm border-[0.16rem] transition-opacity duration-300 ease-out ${
            scene.sidebarState === "hidden"
              ? "opacity-0"
              : scene.sidebarState === "hover"
                ? "border-accent-500"
                : "border-secondary-400"
          }`}
          style={rectStyle(LANDING_HERO_RECTS.sidebar)}
        ></div>

        <div
          class={`absolute inset-0 bg-black/55 transition-opacity duration-400 ${
            scene.scrimVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        ></div>

        <img
          class={`absolute object-cover shadow-[0_1.6em_3.2em_-2em_rgba(0,0,0,0.6)] transition-opacity duration-500 ease-out ${
            scene.popupVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={`${rectStyle(LANDING_HERO_RECTS.popup)} aspect-ratio:2144 / 1318;`}
          src={overlayImageSrc.popup}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      </section>

      <div class="grid grid-rows-[600fr_1322fr] gap-0 rounded-r-lg overflow-hidden">
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
            class={imageLayerClasses(scene.toolFrame === "record-selected")}
            src={toolImageSrc["record-selected"]}
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
        class={`pointer-events-none absolute left-0 top-0 z-30 -translate-x-[0.7em] -translate-y-[0.38em] ${isReducedMotion ? "hidden" : "block"}`}
      >
        <Navigation class="h-[1.6em] w-[1.6em] -scale-x-100 fill-black text-white" strokeWidth={2.15} />
      </div>
    </div>

    <div class="pointer-events-auto relative z-50 mt-8 flex items-center justify-center gap-4 text-md tracking-wide">
      {#each tabProgress as tab (tab.id)}
        <button
          type="button"
          aria-label={tab.label}
          class={`relative flex h-8 cursor-pointer items-center justify-center overflow-hidden border rounded-lg
          px-6 py-5 text-center transition-all duration-700 ease-out ${
            tab.isActive
              ? "border-[#4b5a2a] dark:text-gray-100"
              : "border-[#3d3b2f] text-gray-700 dark:text-gray-400 hover:border-[#596542]"
          }`}
          data-testid={`hero-tab-${tab.id}`}
          onclick={() => {
            jumpToSection(tab.id);
          }}
          onpointerdown={() => {
            jumpToSection(tab.id);
          }}
          onfocus={() => {
            jumpToSection(tab.id);
          }}
          style={tabBackgroundStyle(tab.isActive, tab.progress)}
        >
          <div
            class="relative z-10 flex place-items-center justify-center gap-2.5 text-center font-medium leading-none"
          >
            {#if tab.id === "select"}
              <MousePointerIcon class="h-6 w-6" strokeWidth={2.15} />
            {:else if tab.id === "apply-style"}
              <Paintbrush class="h-6 w-6" />
            {:else if tab.id === "record"}
              <Disc class="h-6 w-6" />
            {:else}
              <Save class="h-6 w-6" />
            {/if}
            <span>{tab.label}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</div>
