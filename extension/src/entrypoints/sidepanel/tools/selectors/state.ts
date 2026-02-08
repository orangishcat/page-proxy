import {derived} from 'svelte/store';
import {selectorEntries} from '../code-editor/state';

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
    const propertyKeys = Array.from(new Set(entry.ruleKeys));
    const propertySet = new Set(propertyKeys);
    const names: string[] = [];

    specialPropertyOrder.forEach((key) => {
      if (key === 'selector') {
        if (propertySet.has(key)) {
          names.push(key);
        }
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
