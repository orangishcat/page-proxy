import { describe, expect, test } from "bun:test";
import {
  activateLandingDemoTool,
  advanceLandingDemoPlayback,
  createLandingDemoPlayback,
  getLandingDemoStep,
  type LandingDemoStepMap,
} from "../../src/lib/components/landing/demo-playback";

const steps = {
  select: ["idle", "selected", "saved"],
  selectors: ["list"],
  record: ["recording", "converted"],
  help: ["tips"],
  share: ["export"],
} satisfies LandingDemoStepMap<string>;

describe("landing demo playback", () => {
  test("starts on the requested default tool and first step", () => {
    const playback = createLandingDemoPlayback("select");

    expect(playback.activeTool).toBe("select");
    expect(playback.stepIndex).toBe(0);
    expect(getLandingDemoStep(steps, playback)).toBe("idle");
  });

  test("advances and wraps within the active tool timeline", () => {
    const first = createLandingDemoPlayback("record");
    const second = advanceLandingDemoPlayback(first, steps);
    const third = advanceLandingDemoPlayback(second, steps);

    expect(getLandingDemoStep(steps, second)).toBe("converted");
    expect(third.stepIndex).toBe(0);
    expect(getLandingDemoStep(steps, third)).toBe("recording");
  });

  test("switching tools resets the step to the start of that tool", () => {
    const advanced = advanceLandingDemoPlayback(createLandingDemoPlayback("select"), steps);
    const switched = activateLandingDemoTool(advanced, "share");

    expect(switched.activeTool).toBe("share");
    expect(switched.stepIndex).toBe(0);
    expect(getLandingDemoStep(steps, switched)).toBe("export");
  });

  test("reselecting the same tool restarts its demo from the beginning", () => {
    const advanced = advanceLandingDemoPlayback(createLandingDemoPlayback("select"), steps);
    const restarted = activateLandingDemoTool(advanced, "select");

    expect(restarted.activeTool).toBe("select");
    expect(restarted.stepIndex).toBe(0);
    expect(getLandingDemoStep(steps, restarted)).toBe("idle");
  });
});
