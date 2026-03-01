import { writable } from 'svelte/store';

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

export const selectorEntries = writable<SelectorEntry[]>([]);
export const codeEditorContent = writable('');

export const sanitizeVariableName = (name: string) =>
  name.replace(/[^A-Za-z0-9_]/g, '_');
