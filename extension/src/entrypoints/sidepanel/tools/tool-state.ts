import {get, writable} from 'svelte/store';
import {browser} from 'wxt/browser';
import {
  readSidePanelOpenTabs,
  setSidePanelOpenForTab as persistSidePanelOpenForTab,
  sidePanelStorageKey
} from '@/lib/sidepanel-state';

export type ToolId = 'select' | 'new-element' | 'selectors' | 'help' | 'share' | 'none';

export type ToolState = {
  activeTool: ToolId;
  codeEditor: {
    content: string;
  };
  sidePanel: {
    openTabs: Record<string, boolean>;
  };
};

const toolStateDefaults: ToolState = {
  activeTool: 'none',
  codeEditor: {content: ''},
  sidePanel: {openTabs: {}}
};

export const currentWebsiteGlob = writable<string | null>(null);
export const toolState = writable<ToolState>(toolStateDefaults);

const isToolId = (value: unknown): value is ToolId =>
  value === 'select' ||
  value === 'new-element' ||
  value === 'selectors' ||
  value === 'help' ||
  value === 'share' ||
  value === 'none';

const coerceToolState = (
  value: unknown,
  openTabs: Record<string, boolean>
): ToolState | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const data = value as {activeTool?: unknown; codeEditor?: unknown};
  const activeTool = isToolId(data.activeTool) ? data.activeTool : toolStateDefaults.activeTool;
  const codeEditor = data.codeEditor as {content?: unknown} | undefined;
  const content = typeof codeEditor?.content === 'string' ? codeEditor.content : toolStateDefaults.codeEditor.content;
  return {
    activeTool,
    codeEditor: {content},
    sidePanel: {openTabs}
  };
};

const readToolState = (websiteGlob: string, openTabs: Record<string, boolean>) => {
  if (!websiteGlob || typeof window === 'undefined') {
    return null;
  }
  const stored = window.localStorage.getItem(websiteGlob);
  if (!stored) {
    return null;
  }
  const parsed = JSON.parse(stored) as unknown;
  return coerceToolState(parsed, openTabs);
};

const persistToolState = (websiteGlob: string, nextState: ToolState) => {
  if (!websiteGlob || typeof window === 'undefined') {
    return;
  }
  const stored = {
    activeTool: nextState.activeTool,
    codeEditor: nextState.codeEditor
  };
  window.localStorage.setItem(websiteGlob, JSON.stringify(stored));
};

export const setWebsiteGlob = (websiteGlob: string | null, initializer?: () => ToolState) => {
  currentWebsiteGlob.set(websiteGlob);
  const openTabs = get(toolState).sidePanel?.openTabs ?? toolStateDefaults.sidePanel.openTabs;
  if (!websiteGlob) {
    const fallback = initializer ? initializer() : toolStateDefaults;
    toolState.set({...fallback, sidePanel: {openTabs}});
    return;
  }
  const storedState = readToolState(websiteGlob, openTabs);
  if (storedState) {
    toolState.set(storedState);
    return;
  }
  const fallback = initializer ? initializer() : toolStateDefaults;
  const nextState = {...fallback, sidePanel: {openTabs}};
  toolState.set(nextState);
  persistToolState(websiteGlob, nextState);
};

export const updateToolState = (next: Partial<ToolState>) => {
  const websiteGlob = get(currentWebsiteGlob);
  const current = get(toolState);
  const merged: ToolState = {
    ...current,
    ...next,
    codeEditor: {
      ...current.codeEditor,
      ...(next.codeEditor ?? {})
    },
    sidePanel: {
      openTabs: next.sidePanel?.openTabs ?? current.sidePanel.openTabs
    }
  };
  toolState.set(merged);
  if (websiteGlob) {
    persistToolState(websiteGlob, merged);
  }
};

export const syncSidePanelState = async () => {
  const openTabs = await readSidePanelOpenTabs();
  toolState.update((current) => ({
    ...current,
    sidePanel: {openTabs}
  }));
};

export const setSidePanelOpenForTab = async (tabId: number, isOpen: boolean) => {
  const openTabs = await persistSidePanelOpenForTab(tabId, isOpen);
  toolState.update((current) => ({
    ...current,
    sidePanel: {openTabs}
  }));
};

export const watchSidePanelState = () => {
  const handleChange = (changes: Record<string, {newValue?: unknown}>) => {
    if (!(sidePanelStorageKey in changes)) {
      return;
    }
    void syncSidePanelState();
  };

  browser.storage.session.onChanged.addListener(handleChange);
  return () => {
    browser.storage.session.onChanged.removeListener(handleChange);
  };
};
