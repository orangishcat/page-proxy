import type { gsap } from "gsap";

export type MotionPoint = {
  x: number;
  y: number;
};

export type PlaybackTimeline = {
  duration: () => number;
  labels: Record<string, number>;
  pause: () => unknown;
  paused: () => boolean;
  play: () => unknown;
  seek: (position: string | number, suppressEvents?: boolean) => unknown;
  time: () => number;
};

type GsapTimeline = ReturnType<typeof gsap.timeline>;
type MotionTarget = HTMLElement | SVGElement;

export const getPointInRoot = (rootEl: HTMLElement | null, panelEl: HTMLElement | null, point: MotionPoint) => {
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

export const setTargetPoint = (
  gsapInstance: typeof gsap,
  target: MotionTarget,
  point: MotionPoint,
  props: Record<string, number | string> = {},
) => {
  gsapInstance.set(target, {
    x: point.x,
    y: point.y,
    ...props,
  });
};

export const moveTimelineTarget = (
  timeline: GsapTimeline,
  target: MotionTarget,
  point: MotionPoint,
  duration: number,
  hold = 1,
) => {
  timeline.to(target, {
    x: point.x,
    y: point.y,
    duration: duration * hold,
    ease: "power2.inOut",
  });
};

export const addTimelinePause = (timeline: GsapTimeline, duration: number) => {
  timeline.to({}, { duration });
};

export const tapCursor = (gsapInstance: typeof gsap, target: MotionTarget, duration: number) => {
  gsapInstance.to(target, {
    scale: 0.84,
    duration: duration / 2,
    repeat: 1,
    yoyo: true,
    ease: "power1.inOut",
    overwrite: "auto",
  });
};
