import type {ElementInfo, ElementSelectionContext, ElementSelectionSource} from '@/lib/selection';
import {derived, get, writable} from 'svelte/store';
import { type PropertyItem, buildPropertyList } from "@/lib/utils/element-info";

export type BoundingBox = ElementInfo['boundingBox'];

export type { PropertyItem };

const defaultSelectionSource: ElementSelectionSource = 'content';

const defaultSelectionContext: ElementSelectionContext = {
  source: defaultSelectionSource,
  tabId: null,
  frameId: 0,
  frameUrl: null
};

export const selectedInfo = writable<ElementInfo | null>(null);
export const propertyItems = derived(selectedInfo, (info) => buildPropertyList(info));
export const hasSelection = derived(selectedInfo, (info) => Boolean(info));
export const selectModeEnabled = writable(false);
export const devtoolsIntegrationDetected = writable(false);
export const followDevtoolsSelection = writable(false);
export const selectionContext = writable<ElementSelectionContext>(defaultSelectionContext);
export const copiedElementCopyId = writable<string | null>(null);
export const copiedElementCut = writable(false);

export const setSelection = (info: ElementInfo | null, context: ElementSelectionContext = defaultSelectionContext) => {
  selectedInfo.set(info);
  selectionContext.set(info ? context : defaultSelectionContext);
};

export const setSelectModeEnabled = (enabled: boolean) => {
  selectModeEnabled.set(enabled);
};

export const setDevtoolsIntegrationDetected = (detected: boolean) => {
  devtoolsIntegrationDetected.set(detected);
};

export const setFollowDevtoolsSelection = (enabled: boolean) => {
  followDevtoolsSelection.set(enabled);
};

export const setCopiedElementState = (copyId: string | null, cut: boolean) => {
  copiedElementCopyId.set(copyId);
  copiedElementCut.set(Boolean(copyId) && cut);
};

export const getSelectionContext = () => get(selectionContext);
