import { derived, writable } from "svelte/store";
import { extractScriptSelectorEntries, type ParsedScriptSelectorEntry } from "@/lib/utils/script-selector-parsing";

export type SelectorEntry = ParsedScriptSelectorEntry;

export type ScriptSelectionOption = {
  scriptName: string;
  websiteGlob: string;
};

export const shouldShowScriptDropdown = (scriptOptions: ScriptSelectionOption[]) => scriptOptions.length > 0;

export const codeEditorContent = writable("");
export const selectorEntries = derived(codeEditorContent, (content) => extractScriptSelectorEntries(content));

export const sanitizeVariableName = (name: string) => name.replace(/[^A-Za-z0-9_]/g, "_");

export type { ElementEntry, ScriptMetadataState } from "@/lib/sidepanel-editor-state";
