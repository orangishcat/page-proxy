import { derived, writable } from "svelte/store";
import { extractScriptSelectorEntries, type ParsedScriptSelectorEntry } from "../../../../lib/utils/script-selector-parsing";

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

export type SelectorEntry = ParsedScriptSelectorEntry;

export type ScriptSelectionOption = {
  scriptName: string;
  websiteGlob: string;
};

export const shouldShowScriptDropdown = (scriptOptions: ScriptSelectionOption[]) =>
  scriptOptions.length > 0;

export type ScriptMetadataState = {
  title: string;
  website: string;
  description: string;
  author: string;
  credits: string;
};

export const codeEditorContent = writable("");
export const selectorEntries = derived(codeEditorContent, (content) => extractScriptSelectorEntries(content));

export const sanitizeVariableName = (name: string) =>
  name.replace(/[^A-Za-z0-9_]/g, "_");
