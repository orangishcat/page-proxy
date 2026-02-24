import type {ElementInfo, ElementSelectionContext, ElementSelectionSource} from '@/lib/selection';
import {derived, get, writable} from 'svelte/store';

export type BoundingBox = ElementInfo['boundingBox'];

export type PropertyItem = {
  key: string;
  label: string;
  value: string;
  rawValue: string | BoundingBox;
  primary: boolean;
};

const defaultSelectionSource: ElementSelectionSource = 'content';

const defaultSelectionContext: ElementSelectionContext = {
  source: defaultSelectionSource,
  tabId: null,
  frameId: 0,
  frameUrl: null
};

const formatBoundingBoxCompact = (box: BoundingBox) =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

const getPrimaryPropertyItems = (info: ElementInfo): PropertyItem[] => {
  const items: PropertyItem[] = [];
  if (info.tag) {
    items.push({
      key: 'tag',
      label: 'Tag',
      value: info.tag,
      rawValue: info.tag,
      primary: true
    });
  }

  if (info.id) {
    items.push({
      key: 'id',
      label: 'ID',
      value: info.id,
      rawValue: info.id,
      primary: true
    });
  }

  if (info.className) {
    items.push({
      key: 'class',
      label: 'Class',
      value: info.className,
      rawValue: info.className,
      primary: true
    });
  }

  if (info.name) {
    items.push({
      key: 'name',
      label: 'Name',
      value: info.name,
      rawValue: info.name,
      primary: true
    });
  }

  items.push({
    key: 'selector',
    label: 'Selector',
    value: info.selector,
    rawValue: info.selector,
    primary: true
  });

  items.push({
    key: 'bbox',
    label: 'BBox',
    value: formatBoundingBoxCompact(info.boundingBox),
    rawValue: info.boundingBox,
    primary: true
  });

  if (info.innerText) {
    items.push({
      key: 'innerText',
      label: 'Inner text',
      value: info.innerText,
      rawValue: info.innerText,
      primary: false
    });
  }

  return items;
};

const buildPropertyList = (info: ElementInfo | null): PropertyItem[] => {
  if (!info) {
    return [];
  }

  const properties = getPrimaryPropertyItems(info);
  const reservedKeys = new Set(['id', 'class', 'name', 'tag', 'selector']);

  Object.entries(info.attributes)
    .filter(([key, value]) => !reservedKeys.has(key) && value.length > 0)
    .forEach(([key, value]) => {
      properties.push({
        key,
        label: key,
        value,
        rawValue: value,
        primary: false
      });
    });

  return properties;
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
