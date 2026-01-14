import {derived} from 'svelte/store';
import {styleEntries} from '../code-editor/state';

export type StylesToolEntry = {
  name: string;
  propertyCount: number;
  propertyNamesText: string;
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

export const styleEntriesDisplay = derived(styleEntries, (entries): StylesToolEntry[] =>
  entries.map((entry) => {
    const propertyKeys = Object.keys(entry.properties);
    const propertySet = new Set(propertyKeys);
    const names: string[] = [];

    specialPropertyOrder.forEach((key) => {
      if (key === 'selector') {
        names.push(key);
        return;
      }

      if (key === 'bbox') {
        if (entry.bbox) {
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
      propertyCount: names.length,
      propertyNamesText: names.length > 0 ? names.join(', ') : 'No properties'
    };
  })
);
