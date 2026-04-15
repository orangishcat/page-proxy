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

export type ScriptMetadataState = {
  title: string;
  website: string;
  description: string;
  author: string;
  credits: string;
};

export type EditorApi = {
  insertDefinitions: (lines: string[]) => void;
  replaceEditorContent: (content: string) => void;
  resetToDefault: () => Promise<void>;
};
