import { tick } from "svelte";
import { LANDING_HERO_POINTS, LANDING_HERO_SCENES, LANDING_HERO_SECTIONS, LANDING_HERO_STATIC_FRAMES, LANDING_HERO_TIMINGS, type LandingHeroSceneId, type LandingHeroSectionId } from "./landing-demo-sequence";
import { addTimelinePause, getPointInRoot, moveTimelineTarget, setTargetPoint, tapCursor, type PlaybackTimeline } from "./landing-motion";
import { buildSectionPlaybackState, getPanelElement, getSceneAtTime, getSectionStartSceneId } from "./landing-demo-progress";

export type LandingDemoPlaybackSnapshot = {
  paused: boolean;
  sceneId: LandingHeroSceneId;
  time: number;
};

type LandingDemoPlaybackElements = {
  getRootEl: () => HTMLDivElement | null;
  getPagePanelEl: () => HTMLElement | null;
  getToolPanelEl: () => HTMLElement | null;
  getEditorPanelEl: () => HTMLElement | null;
  getCursorEl: () => HTMLDivElement | null;
  getPulseEl: () => HTMLDivElement | null;
};

type LandingDemoPlaybackState = {
  getSceneId: () => LandingHeroSceneId;
  getPendingSectionId: () => LandingHeroSectionId | null;
  setSceneId: (sceneId: LandingHeroSceneId) => void;
  setSceneOverrideId: (sceneId: LandingHeroSceneId | null) => void;
  setIsReducedMotion: (value: boolean) => void;
  setIsPlaybackReady: (value: boolean) => void;
  setActiveSectionId: (sectionId: LandingHeroSectionId) => void;
  setActiveSectionProgress: (value: number) => void;
  setPendingSectionId: (sectionId: LandingHeroSectionId | null) => void;
};

export type LandingDemoPlaybackController = {
  start: () => () => void;
  jumpToSection: (sectionId: LandingHeroSectionId) => void;
};

export const createLandingDemoPlaybackController = (
  elements: LandingDemoPlaybackElements,
  state: LandingDemoPlaybackState,
): LandingDemoPlaybackController => {
  let playbackTimeline: PlaybackTimeline | null = null;
  let resumePlaybackTimeout = 0;
  let cleanupPlayback = () => {};
  let rebuildToken = 0;
  let resizeFrame = 0;
  let lastObservedWidth = 0;
  let lastObservedHeight = 0;

  const getSection = (sectionId: LandingHeroSectionId) => LANDING_HERO_SECTIONS.find((entry) => entry.id === sectionId);

  const getRootPoint = (point: (typeof LANDING_HERO_POINTS)[keyof typeof LANDING_HERO_POINTS]) => {
    const rootEl = elements.getRootEl();
    const panelEl = getPanelElement(
      point.panelKey,
      elements.getPagePanelEl(),
      elements.getToolPanelEl(),
      elements.getEditorPanelEl(),
    );
    return getPointInRoot(rootEl, panelEl, point);
  };

  const resetStaticFrame = (isReducedMotion: boolean) => {
    state.setSceneOverrideId(null);
    state.setSceneId(
      getSectionStartSceneId(LANDING_HERO_SECTIONS, state.getPendingSectionId()) ??
        (isReducedMotion ? LANDING_HERO_STATIC_FRAMES.reducedMotion : "initial"),
    );
  };

  const updatePlaybackState = (currentTime: number, labels: Record<string, number>, duration: number) => {
    const nextState = buildSectionPlaybackState(LANDING_HERO_SECTIONS, labels, duration, currentTime);
    state.setActiveSectionId(nextState.activeSectionId);
    state.setActiveSectionProgress(nextState.activeSectionProgress);
  };

  const buildPlayback = async (snapshot: LandingDemoPlaybackSnapshot | null = null) => {
    await tick();

    const rootEl = elements.getRootEl();
    const cursorEl = elements.getCursorEl();
    const pulseEl = elements.getPulseEl();

    if (!rootEl || !cursorEl || !pulseEl) {
      return () => {};
    }

    const root = rootEl;
    const cursor = cursorEl;
    const pulse = pulseEl;

    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    state.setIsReducedMotion(isReducedMotion);
    resetStaticFrame(isReducedMotion);

    if (isReducedMotion) {
      state.setIsPlaybackReady(true);
      return () => {};
    }

    const { gsap } = await import("gsap");
    type GsapTimeline = ReturnType<typeof gsap.timeline>;

    const clickPulse = (point: (typeof LANDING_HERO_POINTS)[keyof typeof LANDING_HERO_POINTS]) => {
      const { x, y } = getRootPoint(point);

      gsap.killTweensOf(pulse);
      gsap.set(pulse, { x, y, opacity: 0.48, scale: 0.35 });
      gsap.to(pulse, {
        opacity: 0,
        scale: 2.05,
        duration: 0.38,
        ease: "power2.out",
      });
      tapCursor(gsap, cursor, LANDING_HERO_TIMINGS.click);
    };

    let context: { revert: () => void } | null = null;

    context = gsap.context(() => {
      const startPoint = getRootPoint(LANDING_HERO_POINTS.cursorStart);

      setTargetPoint(gsap, cursor, startPoint, { opacity: 1, scale: 1 });
      gsap.set(pulse, { opacity: 0, scale: 0.35 });

      const timeline: GsapTimeline = gsap.timeline({
        onUpdate: () => {
          updatePlaybackState(timeline.time(), timeline.labels, timeline.duration());
        },
        repeat: -1,
        repeatDelay: LANDING_HERO_TIMINGS.loopDelay,
      });
      playbackTimeline = timeline;

      timeline.addLabel("initial");
      timeline.call(() => {
        state.setSceneId("initial");
        const origin = getRootPoint(LANDING_HERO_POINTS.cursorStart);
        setTargetPoint(gsap, cursor, origin, { scale: 1 });
        gsap.set(pulse, { opacity: 0, scale: 0.35 });
      });

      moveTimelineTarget(
        timeline,
        cursor,
        getRootPoint(LANDING_HERO_POINTS.selectTool),
        LANDING_HERO_TIMINGS.move,
        0.95,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("select-tool");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.selectTool);
        state.setSceneId("select-tool");
      });

      moveTimelineTarget(timeline, cursor, getRootPoint(LANDING_HERO_POINTS.sidebar), LANDING_HERO_TIMINGS.move);
      timeline.addLabel("sidebar-hover");
      timeline.call(() => {
        state.setSceneId("sidebar-hover");
      });
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("sidebar-selected");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.sidebar);
        state.setSceneId("sidebar-selected");
      });

      moveTimelineTarget(
        timeline,
        cursor,
        getRootPoint(LANDING_HERO_POINTS.menuButton),
        LANDING_HERO_TIMINGS.move,
        0.9,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("menu-open");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.menuButton);
        state.setSceneId("menu-open");
      });

      moveTimelineTarget(
        timeline,
        cursor,
        getRootPoint(LANDING_HERO_POINTS.deleteElement),
        LANDING_HERO_TIMINGS.move,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("page-deleted");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.deleteElement);
        state.setSceneId("page-deleted");
      });

      moveTimelineTarget(
        timeline,
        cursor,
        getRootPoint(LANDING_HERO_POINTS.recordTool),
        LANDING_HERO_TIMINGS.move,
        0.95,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("record-tool");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.recordTool);
        state.setSceneId("record-tool");
      });

      moveTimelineTarget(
        timeline,
        cursor,
        getRootPoint(LANDING_HERO_POINTS.recordConfirm),
        LANDING_HERO_TIMINGS.move,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("record-selected");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.recordConfirm);
        state.setSceneId("record-selected");
      });

      moveTimelineTarget(timeline, cursor, getRootPoint(LANDING_HERO_POINTS.convertCode), LANDING_HERO_TIMINGS.move);
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("convert-code");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.convertCode);
        state.setSceneId("convert-code");
      });

      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle * 0.8);
      timeline.addLabel("record-popup");
      timeline.call(() => {
        state.setSceneId("record-popup");
      });

      moveTimelineTarget(
        timeline,
        cursor,
        getRootPoint(LANDING_HERO_POINTS.popupSave),
        LANDING_HERO_TIMINGS.move,
        1.1,
      );
      addTimelinePause(timeline, LANDING_HERO_TIMINGS.settle);
      timeline.addLabel("saved");
      timeline.call(() => {
        clickPulse(LANDING_HERO_POINTS.popupSave);
        state.setSceneId("saved");
      });

      timeline.to({}, { duration: LANDING_HERO_TIMINGS.finalHold });

      if (snapshot) {
        timeline.pause();
        timeline.seek(snapshot.time, true);
        state.setSceneId(getSceneAtTime(LANDING_HERO_SCENES.map((scene) => scene.id), timeline.labels, timeline.duration(), snapshot.time));
        state.setSceneOverrideId(null);
        state.setPendingSectionId(null);
        updatePlaybackState(timeline.time(), timeline.labels, timeline.duration());

        if (!snapshot.paused) {
          timeline.play();
        }
      } else {
        const initialSectionSceneId = getSectionStartSceneId(LANDING_HERO_SECTIONS, state.getPendingSectionId());
        if (initialSectionSceneId) {
          timeline.pause();
          timeline.seek(initialSectionSceneId, true);
          state.setSceneId(initialSectionSceneId);
          state.setSceneOverrideId(initialSectionSceneId);
          updatePlaybackState(timeline.time(), timeline.labels, timeline.duration());
          resumePlaybackTimeout = window.setTimeout(() => {
            state.setSceneOverrideId(null);
            state.setPendingSectionId(null);
            timeline.play();
          }, 220);
        } else {
          updatePlaybackState(0, timeline.labels, timeline.duration());
        }
      }

      state.setIsPlaybackReady(true);
    }, root);

    return () => {
      state.setIsPlaybackReady(false);
      playbackTimeline = null;
      window.clearTimeout(resumePlaybackTimeout);
      state.setSceneOverrideId(null);
      context?.revert();
    };
  };

  const rebuildPlayback = async (preserveState: boolean) => {
    const nextToken = ++rebuildToken;
    const snapshot = preserveState && playbackTimeline
      ? {
          paused: playbackTimeline.paused(),
          sceneId: state.getSceneId(),
          time: playbackTimeline.time(),
        }
      : null;

    cleanupPlayback();
    cleanupPlayback = () => {};

    const nextCleanup = await buildPlayback(snapshot);
    if (nextToken !== rebuildToken) {
      nextCleanup();
      return;
    }

    cleanupPlayback = nextCleanup;
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

  const start = () => {
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

    const rootEl = elements.getRootEl();
    if (rootEl) {
      resizeObserver.observe(rootEl);
    }

    const onMotionChange = () => {
      void rebuildPlayback(true);
    };

    window.addEventListener("resize", schedulePlaybackRefresh);
    reducedMotionQuery.addEventListener("change", onMotionChange);
    void rebuildPlayback(false);

    return () => {
      rebuildToken += 1;
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", schedulePlaybackRefresh);
      reducedMotionQuery.removeEventListener("change", onMotionChange);
      resizeObserver.disconnect();
      cleanupPlayback();
    };
  };

  const jumpToSection = (sectionId: LandingHeroSectionId) => {
    const section = getSection(sectionId);
    if (!section) {
      return;
    }

    state.setPendingSectionId(sectionId);
    state.setSceneOverrideId(section.startSceneId);
    state.setSceneId(section.startSceneId);
    state.setActiveSectionId(sectionId);
    state.setActiveSectionProgress(0);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !playbackTimeline) {
      return;
    }

    window.clearTimeout(resumePlaybackTimeout);
    playbackTimeline.pause();
    playbackTimeline.seek(section.startSceneId, true);
    state.setSceneId(section.startSceneId);
    updatePlaybackState(playbackTimeline.time(), playbackTimeline.labels, playbackTimeline.duration());

    resumePlaybackTimeout = window.setTimeout(() => {
      state.setSceneOverrideId(null);
      state.setPendingSectionId(null);
      playbackTimeline?.play();
    }, 220);
  };

  return {
    start,
    jumpToSection,
  };
};
