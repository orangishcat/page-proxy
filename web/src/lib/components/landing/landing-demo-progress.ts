import type {
  HeroPanelKey,
  LandingHeroRect,
  LandingHeroSceneId,
  LandingHeroSection,
  LandingHeroSectionId,
} from "./landing-demo-sequence";

export type LandingDemoTabProgress<TTab extends { id: string }> = TTab & {
  isActive: boolean;
  progress: number;
};

export const toPercent = (value: number) => `${value * 100}%`;

export const rectStyle = (rect: LandingHeroRect) =>
  `left:${toPercent(rect.x)};top:${toPercent(rect.y)};width:${toPercent(rect.width)};height:${toPercent(rect.height)};`;

export const imageLayerClasses = (visible: boolean) =>
  `absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out ${
    visible ? "opacity-100" : "pointer-events-none opacity-0"
  }`;

export const tabBackgroundStyle = (isActive: boolean, progress: number) => {
  const stop = `${Math.max(0, Math.min(1, progress)) * 100}%`;

  if (!isActive) {
    return "background: rgba(63, 61, 56, 0.2);";
  }

  return `background: linear-gradient(90deg, rgba(146, 223, 70, 0.24) 0%, rgba(146, 223, 70, 0.12) ${stop}, rgba(63, 61, 56, 0.92) ${stop}, rgba(63, 61, 56, 0.92) 100%);`;
};

export const buildTabProgress = <TTab extends { id: LandingHeroSectionId }>(
  tabs: readonly TTab[],
  activeSectionId: LandingHeroSectionId,
  activeSectionProgress: number,
): LandingDemoTabProgress<TTab>[] =>
  tabs.map((tab) => ({
    ...tab,
    isActive: tab.id === activeSectionId,
    progress: tab.id === activeSectionId ? activeSectionProgress : 0,
  }));

export const getSectionStartSceneId = (sections: readonly LandingHeroSection[], sectionId: LandingHeroSectionId | null) => {
  if (!sectionId) {
    return null;
  }

  return sections.find((entry) => entry.id === sectionId)?.startSceneId ?? null;
};

export const getPanelElement = (
  panelKey: HeroPanelKey,
  pagePanelEl: HTMLElement | null,
  toolPanelEl: HTMLElement | null,
  editorPanelEl: HTMLElement | null,
) => {
  if (panelKey === "page") return pagePanelEl;
  if (panelKey === "tool") return toolPanelEl;
  return editorPanelEl;
};

export const getSceneAtTime = (
  sceneIds: readonly LandingHeroSceneId[],
  labels: Record<string, number>,
  duration: number,
  currentTime: number,
) => {
  const sceneTimes = sceneIds
    .map((sceneId) => ({
      sceneId,
      start: labels[sceneId] ?? duration,
    }))
    .filter((scene) => scene.start <= duration)
    .sort((left, right) => left.start - right.start);

  return sceneTimes.findLast((scene) => currentTime >= scene.start)?.sceneId ?? sceneTimes[0]?.sceneId ?? "initial";
};

export const buildSectionPlaybackState = (
  sections: readonly LandingHeroSection[],
  labels: Record<string, number>,
  duration: number,
  currentTime: number,
) => {
  const sectionTimes = sections.map((section, index) => {
    const start = labels[section.startSceneId] ?? 0;
    const nextStart = sections[index + 1]?.startSceneId;
    const end = nextStart ? labels[nextStart] ?? duration : duration;

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
  return {
    activeSectionId: currentSection.id,
    activeSectionProgress: Math.min(1, Math.max(0, (currentTime - currentSection.start) / span)),
  };
};
