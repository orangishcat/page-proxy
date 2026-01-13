import type {ElementInfo} from '@/lib/selection';
import {derived, writable} from 'svelte/store';

export type BoundingBox = ElementInfo['boundingBox'];

export type PropertyItem = {
  key: string;
  label: string;
  value: string;
  rawValue: string | BoundingBox;
  primary: boolean;
};

const formatBoundingBoxCompact = (box: BoundingBox) =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

const getPrimaryPropertyItems = (info: ElementInfo): PropertyItem[] => {
  const items: PropertyItem[] = [];

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

  if (info.tag) {
    items.push({
      key: 'tag',
      label: 'Tag',
      value: info.tag,
      rawValue: info.tag,
      primary: true
    });
  }

  items.push({
    key: 'bbox',
    label: 'BBox',
    value: formatBoundingBoxCompact(info.boundingBox),
    rawValue: info.boundingBox,
    primary: true
  });

  return items;
};

const buildPropertyList = (info: ElementInfo | null): PropertyItem[] => {
  if (!info) {
    return [];
  }

  const properties = getPrimaryPropertyItems(info);
  const reservedKeys = new Set(['id', 'class', 'name', 'tag']);

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

export const setSelection = (info: ElementInfo | null) => {
  selectedInfo.set(info);
};
