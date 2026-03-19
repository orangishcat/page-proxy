export type LandingHeroSceneId =
  | "initial"
  | "select-tool"
  | "sidebar-hover"
  | "sidebar-selected"
  | "menu-open"
  | "page-deleted"
  | "record-tool"
  | "record-selected"
  | "convert-code"
  | "record-popup"
  | "saved";

export type LandingHeroSectionId = "select" | "apply-style" | "record" | "save-code";

export type HeroPanelKey = "page" | "tool" | "editor";
export type HeroPageFrame = "before" | "after";
export type HeroToolFrame = "select-empty" | "select-selected" | "record" | "record-selected";
export type HeroEditorFrame = "empty" | "saved";
export type HeroSidebarState = "hidden" | "hover" | "selected";

export type LandingHeroScene = {
  id: LandingHeroSceneId;
  pageFrame: HeroPageFrame;
  toolFrame: HeroToolFrame;
  editorFrame: HeroEditorFrame;
  sidebarState: HeroSidebarState;
  menuVisible: boolean;
  popupVisible: boolean;
  scrimVisible: boolean;
};

export type LandingHeroPoint = {
  panelKey: HeroPanelKey;
  x: number;
  y: number;
};

export type LandingHeroRect = {
  panelKey: HeroPanelKey;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LandingHeroSection = {
  id: LandingHeroSectionId;
  startSceneId: LandingHeroSceneId;
};

export const LANDING_HERO_ASSETS = {
  page: {
    before: "/assets/page_before_run.png",
    after: "/assets/page_after_run.png",
  },
  tool: {
    "select-empty": "/assets/select_tool_empty.png",
    "select-selected": "/assets/select_tool_selected.png",
    record: "/assets/record_tool_noselect.png",
    "record-selected": "/assets/record_tool_selected.png",
  },
  editor: {
    empty: "/assets/code_editor_empty.png",
    saved: "/assets/code_editor_saved.png",
  },
  overlays: {
    menu: "/assets/select_menu.png",
    popup: "/assets/record_popup.png",
  },
} as const;

export const LANDING_HERO_SCENES = [
  {
    id: "initial",
    pageFrame: "before",
    toolFrame: "select-empty",
    editorFrame: "empty",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "select-tool",
    pageFrame: "before",
    toolFrame: "select-selected",
    editorFrame: "empty",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "sidebar-hover",
    pageFrame: "before",
    toolFrame: "select-selected",
    editorFrame: "empty",
    sidebarState: "hover",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "sidebar-selected",
    pageFrame: "before",
    toolFrame: "select-selected",
    editorFrame: "empty",
    sidebarState: "selected",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "menu-open",
    pageFrame: "before",
    toolFrame: "select-selected",
    editorFrame: "empty",
    sidebarState: "selected",
    menuVisible: true,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "page-deleted",
    pageFrame: "after",
    toolFrame: "select-selected",
    editorFrame: "empty",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "record-tool",
    pageFrame: "after",
    toolFrame: "record",
    editorFrame: "empty",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "record-selected",
    pageFrame: "after",
    toolFrame: "record-selected",
    editorFrame: "empty",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "convert-code",
    pageFrame: "after",
    toolFrame: "record-selected",
    editorFrame: "empty",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
  {
    id: "record-popup",
    pageFrame: "after",
    toolFrame: "record-selected",
    editorFrame: "empty",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: true,
    scrimVisible: true,
  },
  {
    id: "saved",
    pageFrame: "after",
    toolFrame: "record-selected",
    editorFrame: "saved",
    sidebarState: "hidden",
    menuVisible: false,
    popupVisible: false,
    scrimVisible: false,
  },
] as const satisfies readonly LandingHeroScene[];

export const LANDING_HERO_SCENE_IDS = LANDING_HERO_SCENES.map((scene) => scene.id);
export const LANDING_HERO_SCENE_INDEX = Object.fromEntries(
  LANDING_HERO_SCENE_IDS.map((sceneId, index) => [sceneId, index]),
) as Record<LandingHeroSceneId, number>;

export const LANDING_HERO_SCENE_MAP = Object.fromEntries(
  LANDING_HERO_SCENES.map((scene) => [scene.id, scene]),
) as Record<LandingHeroSceneId, LandingHeroScene>;

export const LANDING_HERO_SECTIONS = [
  { id: "select", startSceneId: "initial" },
  { id: "apply-style", startSceneId: "menu-open" },
  { id: "record", startSceneId: "record-tool" },
  { id: "save-code", startSceneId: "convert-code" },
] as const satisfies readonly LandingHeroSection[];

export const LANDING_HERO_STATIC_FRAMES = {
  reducedMotion: "saved",
} as const satisfies Record<string, LandingHeroSceneId>;

export const LANDING_HERO_TIMINGS = {
  move: 1.02,
  click: 0.24,
  settle: 0.5,
  finalHold: 1.7,
  loopDelay: 0.8,
} as const;

export const LANDING_HERO_POINTS = {
  cursorStart: { panelKey: "page", x: 0.58, y: 0.58 },
  selectTool: { panelKey: "tool", x: 0.065, y: 0.05 },
  sidebar: { panelKey: "page", x: 0.905, y: 0.14 },
  menuButton: { panelKey: "tool", x: 0.925, y: 0.9 },
  deleteElement: { panelKey: "tool", x: 0.79, y: 0.79 },
  recordTool: { panelKey: "tool", x: 0.29, y: 0.05 },
  recordConfirm: { panelKey: "tool", x: 0.81, y: 0.89 },
  convertCode: { panelKey: "tool", x: 0.5, y: 0.89 },
  popupSave: { panelKey: "page", x: 0.87, y: 0.815 },
} as const satisfies Record<string, LandingHeroPoint>;

export const LANDING_HERO_RECTS = {
  sidebar: { panelKey: "page", x: 0.83, y: 0.055, width: 0.17, height: 0.4 },
  menu: { panelKey: "tool", x: 0.43, y: 0.25, width: 0.56, height: 0.59 },
  popup: { panelKey: "page", x: 0.06, y: 0.15, width: 0.84, height: 0.69 },
} as const satisfies Record<string, LandingHeroRect>;
