import {derived} from 'svelte/store';
import {selectorEntries} from '../code-editor/state';
import type {SelectorPropertyFilters} from '@/lib/sandbox';

export type SelectorsToolEntry = {
  name: string;
  ruleCount: number;
  ruleNamesText: string;
};

const specialPropertyOrder = [
  'tag',
  'id',
  'class',
  'name',
  'innerText',
  'selector',
  'bbox'
];

export const selectorEntriesDisplay = derived(selectorEntries, (entries): SelectorsToolEntry[] =>
  entries.map((entry) => {
    const isLegacyProperties = (value: unknown): value is SelectorPropertyFilters =>
      typeof value === 'object' &&
      value !== null &&
      (Object.prototype.hasOwnProperty.call(value, 'contains') ||
        Object.prototype.hasOwnProperty.call(value, 'matches') ||
        Object.prototype.hasOwnProperty.call(value, 'keyOnly'));

    const propertyKeys = Array.from(
      new Set(
        isLegacyProperties(entry.properties)
          ? [
              ...Object.keys(entry.properties.contains),
              ...Object.keys(entry.properties.matches),
              ...entry.properties.keyOnly
            ]
          : Object.keys(entry.properties)
      )
    );
    const propertySet = new Set(propertyKeys);
    const names: string[] = [];

    specialPropertyOrder.forEach((key) => {
      if (key === 'selector') {
        names.push(key);
        return;
      }

      if (key === 'bbox') {
        if (entry.bbox || propertySet.has(key)) {
          names.push(key);
        }
        return;
      }

      if (propertySet.has(key)) {
        names.push(key);
      }
    });

    propertyKeys
      .filter((key) => !names.includes(key) && !['selector', 'bbox'].includes(key))
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        names.push(key);
      });

    return {
      name: entry.name,
      ruleCount: names.length,
      ruleNamesText: names.length > 0 ? names.join(', ') : 'No rules'
    };
  })
);
