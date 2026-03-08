import { getContext, setContext } from "svelte";
import type { ScriptGrantValue } from "@/lib/grants";
import type { ElementEntry, ScriptMetadataState } from "../tools/code-editor/state";

const key = Symbol("editor");

type EditorApi = {
  insertDefinitions: (lines: string[]) => void;
  replaceEditorContent: (content: string) => void;
  resetToDefault: () => Promise<void>;
};

export function createEditorContext() {
  let elementEntries = $state<ElementEntry[]>([]);
  let scriptMetadata = $state<ScriptMetadataState>({
    title: "Page Proxy",
    website: "",
    description: "",
    author: "",
    credits: "",
  });
  let allowedGrants = $state<ScriptGrantValue[]>([]);
  let api = $state<EditorApi | null>(null);

  const insertDefinitions = (lines: string[]): boolean => {
    if (!api) {
      return false;
    }
    api.insertDefinitions(lines);
    return true;
  };

  const replaceEditorContent = (content: string): boolean => {
    if (!api) {
      return false;
    }
    api.replaceEditorContent(content);
    return true;
  };

  const resetToDefault = async (): Promise<void> => {
    if (!api) {
      throw new Error("Editor is not ready.");
    }
    await api.resetToDefault();
  };

  return {
    get elementEntries() { return elementEntries; },
    set elementEntries(v: ElementEntry[]) { elementEntries = v; },
    get scriptMetadata() { return scriptMetadata; },
    set scriptMetadata(v: ScriptMetadataState) { scriptMetadata = v; },
    get allowedGrants() { return allowedGrants; },
    set allowedGrants(v: ScriptGrantValue[]) { allowedGrants = v; },
    get api() { return api; },
    set api(v: EditorApi | null) { api = v; },
    insertDefinitions,
    replaceEditorContent,
    resetToDefault,
  };
}

export type EditorContext = ReturnType<typeof createEditorContext>;

export const setEditorContext = (ctx: EditorContext) => setContext(key, ctx);
export const getEditorContext = () => getContext<EditorContext>(key);
