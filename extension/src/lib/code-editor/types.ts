import type * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";

export type MonacoEditor = monaco.editor.IStandaloneCodeEditor;

export type MonacoMarkerSeverity = "error" | "warning" | "info" | "hint";

export type MonacoEditorMarker = {
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  severity: MonacoMarkerSeverity;
};

export type MonacoCodeEditorHandle = {
  editor: MonacoEditor;
  model: monaco.editor.ITextModel;
  dispose: () => void;
};

export type CreateMonacoEditorOptions = {
  language?: string;
  readOnly?: boolean;
  lineNumbers?: "on" | "off";
  minimap?: boolean;
  wordWrap?: "off" | "on";
  modelUri?: string;
  className?: string;
  padding?: { top: number; bottom: number };
  onChange?: (value: string) => void;
  editorOptions?: monaco.editor.IStandaloneEditorConstructionOptions;
};
