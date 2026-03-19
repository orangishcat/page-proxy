export type LandingDemoToolId = "select" | "selectors" | "record" | "help" | "share";

export type LandingDemoPlayback = {
  activeTool: LandingDemoToolId;
  stepIndex: number;
};

export type LandingDemoStepMap<TStep> = Record<LandingDemoToolId, readonly TStep[]>;

export const createLandingDemoPlayback = (defaultTool: LandingDemoToolId): LandingDemoPlayback => ({
  activeTool: defaultTool,
  stepIndex: 0,
});

export const activateLandingDemoTool = (
  playback: LandingDemoPlayback,
  tool: LandingDemoToolId,
): LandingDemoPlayback => ({
  ...playback,
  activeTool: tool,
  stepIndex: 0,
});

export const advanceLandingDemoPlayback = <TStep>(
  playback: LandingDemoPlayback,
  steps: LandingDemoStepMap<TStep>,
): LandingDemoPlayback => {
  const activeSteps = steps[playback.activeTool];
  if (activeSteps.length === 0) {
    return playback;
  }

  return {
    ...playback,
    stepIndex: (playback.stepIndex + 1) % activeSteps.length,
  };
};

export const getLandingDemoStep = <TStep>(
  steps: LandingDemoStepMap<TStep>,
  playback: LandingDemoPlayback,
): TStep => steps[playback.activeTool][playback.stepIndex] as TStep;
