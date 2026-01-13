import {derived} from 'svelte/store';
import {styleEntries, getFormattedBoundingBox} from '../code-editor/state';

export type StylesToolEntry = {
  name: string;
  selector: string;
  bboxText: string | null;
  propertyCount: number;
};

export const styleEntriesDisplay = derived(styleEntries, (entries): StylesToolEntry[] =>
  entries.map((entry) => ({
    name: entry.name,
    selector: entry.selector,
    bboxText: entry.bbox ? getFormattedBoundingBox(entry.bbox) : null,
    propertyCount: Object.keys(entry.properties).length
  }))
);
