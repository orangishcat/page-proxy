import type * as monaco from "monaco-editor/editor/editor.api";

type BuildEditorConstructionOptionsArgs = {
  model: monaco.editor.ITextModel;
  readOnly: boolean;
  lineNumbers: "on" | "off";
  minimap: boolean;
  wordWrap: "off" | "on";
  padding: { top: number; bottom: number };
  editorOptions: monaco.editor.IStandaloneEditorConstructionOptions;
};

export const buildEditorConstructionOptions = ({
  model,
  readOnly,
  lineNumbers,
  minimap,
  wordWrap,
  padding,
  editorOptions,
}: BuildEditorConstructionOptionsArgs): monaco.editor.IStandaloneEditorConstructionOptions => ({
  model,
  automaticLayout: true,
  readOnly,
  lineNumbers,
  minimap: { enabled: minimap },
  wordWrap,
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: false,
  smoothScrolling: true,
  mouseWheelZoom: true,
  glyphMargin: false,
  folding: !readOnly,
  renderWhitespace: "selection",
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true,
  },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: "on",
  snippetSuggestions: "inline",
  parameterHints: { enabled: true },
  inlineSuggest: { enabled: true },
  "semanticHighlighting.enabled": true,
  bracketPairColorization: { enabled: true },
  scrollBeyondLastLine: false,
  lineDecorationsWidth: lineNumbers === "off" ? 0 : 10,
  lineNumbersMinChars: lineNumbers === "off" ? 0 : 3,
  padding,
  fontFamily:
    "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  fontSize: 13,
  lineHeight: 20,
  ...editorOptions,
});
