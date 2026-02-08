import {get, writable} from 'svelte/store';
import type {BoundingBox, ElementEntry, SelectorEntry} from '@/lib/sandbox';

export type {BoundingBox, ElementEntry, SelectorEntry};

export type ScriptMetadataState = {
  title: string;
  website: string;
  description: string;
};

export const elementEntries = writable<ElementEntry[]>([]);
export const selectorEntries = writable<SelectorEntry[]>([]);
export const scriptMetadata = writable<ScriptMetadataState>({
  title: 'Page Proxy',
  website: '',
  description: ''
});

type EditorApi = {
  insertDefinitions: (lines: string[]) => void;
};

const editorApi = writable<EditorApi | null>(null);

export const setEditorApi = (api: EditorApi | null) => {
  editorApi.set(api);
};

export const insertDefinitions = (lines: string[]) => {
  const api = get(editorApi);
  if (!api) {
    return false;
  }

  api.insertDefinitions(lines);
  return true;
};

const formatBoundingBoxCompact = (box: BoundingBox) =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

export const formatElementCode = (entry: ElementEntry, variableName: string) => {
  const payload = {
    name: entry.name,
    selector: entry.selector,
    bbox: entry.bbox,
    attributes: entry.attributes
  };

  return `const ${variableName} = pa.element(${JSON.stringify(payload, null, 2)});`;
};

export const sanitizeVariableName = (name: string) =>
  name.replace(/[^A-Za-z0-9_]/g, '_');

export const getFormattedBoundingBox = formatBoundingBoxCompact;
