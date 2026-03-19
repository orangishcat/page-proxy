import { describe, expect, test } from "bun:test";
import {
  LANDING_HERO_POINTS,
  LANDING_HERO_SCENES,
  LANDING_HERO_SCENE_IDS,
  LANDING_HERO_STATIC_FRAMES,
  LANDING_HERO_TIMINGS,
} from "../../src/lib/components/landing/landing-demo-sequence";

describe("landing hero sequence", () => {
  test("plays the expected scene ids in order", () => {
    expect(LANDING_HERO_SCENE_IDS).toEqual([
      "initial",
      "select-tool",
      "sidebar-hover",
      "sidebar-selected",
      "menu-open",
      "page-deleted",
      "record-tool",
      "record-popup",
      "saved",
    ]);
  });

  test("captures the key visual state transitions", () => {
    expect(LANDING_HERO_SCENES[0]).toMatchObject({
      id: "initial",
      pageFrame: "before",
      toolFrame: "select-empty",
      editorFrame: "empty",
      sidebarState: "hidden",
      menuVisible: false,
      popupVisible: false,
    });

    expect(LANDING_HERO_SCENES.find((scene) => scene.id === "menu-open")).toMatchObject({
      toolFrame: "select-selected",
      sidebarState: "selected",
      menuVisible: true,
    });

    expect(LANDING_HERO_SCENES.find((scene) => scene.id === "record-popup")).toMatchObject({
      pageFrame: "after",
      toolFrame: "record",
      popupVisible: true,
    });

    expect(LANDING_HERO_SCENES.at(-1)).toMatchObject({
      id: "saved",
      pageFrame: "after",
      toolFrame: "record",
      editorFrame: "saved",
      popupVisible: false,
    });
  });

  test("keeps the reduced-motion frame and loop timing explicit", () => {
    expect(LANDING_HERO_STATIC_FRAMES.reducedMotion).toBe("saved");
    expect(LANDING_HERO_TIMINGS.move).toBeGreaterThanOrEqual(0.95);
    expect(LANDING_HERO_TIMINGS.settle).toBeGreaterThanOrEqual(0.45);
    expect(LANDING_HERO_TIMINGS.finalHold).toBeGreaterThanOrEqual(1.5);
    expect(LANDING_HERO_TIMINGS.loopDelay).toBeGreaterThanOrEqual(0.7);
  });

  test("starts the cursor away from the first click target", () => {
    expect(LANDING_HERO_POINTS.cursorStart).not.toEqual(LANDING_HERO_POINTS.selectTool);
  });
});
