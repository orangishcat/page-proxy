import { describe, expect, test } from "bun:test";
import {
  buildSectionPlaybackState,
  buildTabProgress,
  getSceneAtTime,
  getSectionStartSceneId,
  imageLayerClasses,
  rectStyle,
  tabBackgroundStyle,
} from "../../src/lib/components/landing/landing-demo-progress";
import {
  LANDING_HERO_RECTS,
  LANDING_HERO_SCENE_IDS,
  LANDING_HERO_SECTIONS,
  type LandingHeroSectionId,
} from "../../src/lib/components/landing/landing-demo-sequence";

describe("landing demo progress helpers", () => {
  test("builds tab progress state for the active section", () => {
    const progress = buildTabProgress(
      [
        { id: "select", label: "Select" },
        { id: "record", label: "Record" },
      ] as const satisfies readonly { id: LandingHeroSectionId; label: string }[],
      "record",
      0.42,
    );

    expect(progress).toEqual([
      { id: "select", label: "Select", isActive: false, progress: 0 },
      { id: "record", label: "Record", isActive: true, progress: 0.42 },
    ]);
  });

  test("derives the active section and scene from timeline position", () => {
    const sectionState = buildSectionPlaybackState(
      LANDING_HERO_SECTIONS,
      {
        initial: 0,
        "menu-open": 3,
        "record-tool": 6,
        convertCode: 9,
      },
      12,
      4,
    );

    expect(sectionState.activeSectionId).toBe("apply-style");
    expect(sectionState.activeSectionProgress).toBeGreaterThan(0);
    expect(sectionState.activeSectionProgress).toBeLessThan(1);
    expect(getSceneAtTime(LANDING_HERO_SCENE_IDS, { initial: 0, "menu-open": 3, "record-tool": 6 }, 12, 4)).toBe(
      "menu-open",
    );
  });

  test("resolves section start scenes and renders styles consistently", () => {
    expect(getSectionStartSceneId(LANDING_HERO_SECTIONS, "record")).toBe("record-tool");
    expect(getSectionStartSceneId(LANDING_HERO_SECTIONS, null)).toBeNull();
    expect(rectStyle(LANDING_HERO_RECTS.sidebar)).toContain("left:");
    expect(imageLayerClasses(true)).toContain("opacity-100");
    expect(imageLayerClasses(false)).toContain("pointer-events-none opacity-0");
    expect(tabBackgroundStyle(true, 0.5)).toContain("linear-gradient");
    expect(tabBackgroundStyle(false, 0.5)).toContain("rgba(63, 61, 56, 0.2)");
  });
});
