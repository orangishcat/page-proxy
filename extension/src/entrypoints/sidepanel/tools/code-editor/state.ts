import {get, writable} from 'svelte/store';

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ElementEntry = {
  name: string;
  selector: string;
  bbox: BoundingBox;
  attributes: Record<string, string>;
};

export type SelectorEntry = {
  name: string;
  ruleKeys: string[];
  rules?: string[];
  mode?: "pp-api" | "css";
};

export type ScriptMetadataState = {
  title: string;
  website: string;
  description: string;
  author: string;
  credits: string;
};

export const elementEntries = writable<ElementEntry[]>([]);
export const selectorEntries = writable<SelectorEntry[]>([]);
export const codeEditorContent = writable('');
export const scriptMetadata = writable<ScriptMetadataState>({
  title: 'Page Proxy',
  website: '',
  description: '',
  author: '',
  credits: ''
});

type EditorApi = {
  insertDefinitions: (lines: string[]) => void;
  resetToDefault: () => Promise<void>;
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

export const resetEditorToDefault = async () => {
  const api = get(editorApi);
  if (!api) {
    throw new Error("Editor is not ready.");
  }

  await api.resetToDefault();
};

export const sanitizeVariableName = (name: string) =>
  name.replace(/[^A-Za-z0-9_]/g, '_');
