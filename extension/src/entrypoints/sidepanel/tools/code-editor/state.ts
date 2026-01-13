import type {BoundingBox} from '../select-tool/state';
import {get, writable} from 'svelte/store';

export type ElementEntry = {
  name: string;
  selector: string;
  bbox: BoundingBox;
  attributes: Record<string, string>;
};

export type StyleEntry = {
  name: string;
  selector: string;
  bbox?: BoundingBox;
  properties: Record<string, string>;
};

export type ScriptMetadataState = {
  title: string;
  website: string;
  description: string;
};

export const elementEntries = writable<ElementEntry[]>([]);
export const styleEntries = writable<StyleEntry[]>([]);
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

export const buildDefinitionComment = (
  prefix: 'element' | 'style',
  name: string,
  selector: string,
  bbox: BoundingBox | null,
  entries: Record<string, string>,
  entryPrefix: 'attr' | 'prop'
) => {
  const encoded = (value: string) => value.replace(/"/g, "'");
  const baseParts = [
    `// pp:${prefix} name="${encoded(name)}"`,
    `selector="${encoded(selector)}"`
  ];

  if (bbox) {
    baseParts.push(`bbox="${formatBoundingBoxCompact(bbox)}"`);
  }

  Object.entries(entries).forEach(([key, value]) => {
    baseParts.push(`${entryPrefix}:${key}="${encoded(value)}"`);
  });

  return baseParts.join(' ');
};

export const formatElementCode = (entry: ElementEntry, variableName: string) => {
  const payload = {
    name: entry.name,
    selector: entry.selector,
    bbox: entry.bbox,
    attributes: entry.attributes
  };

  return `const ${variableName} = pp.element(${JSON.stringify(payload, null, 2)});`;
};

export const formatStyleCode = (entry: StyleEntry, variableName: string) => {
  const payload = {
    name: entry.name,
    selector: entry.selector,
    bbox: entry.bbox,
    properties: entry.properties
  };

  return `const ${variableName} = pp.style(${JSON.stringify(payload, null, 2)});`;
};

export const getFormattedBoundingBox = formatBoundingBoxCompact;
