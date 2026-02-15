import {get, writable} from 'svelte/store';
import type {ElementEntry, SelectorEntry} from '@/lib/sandbox';

export type {ElementEntry, SelectorEntry};

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

export const sanitizeVariableName = (name: string) =>
  name.replace(/[^A-Za-z0-9_]/g, '_');
