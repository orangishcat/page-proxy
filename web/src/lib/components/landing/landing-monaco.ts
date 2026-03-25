import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import "monaco-editor/esm/vs/editor/edcore.main.js";
import "monaco-editor/min/vs/editor/editor.main.css";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

type MonacoEnvironment = {
  getWorker?: (moduleId: string, label: string) => Worker;
};

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironment;
};

export type LandingMonacoPreviewHandle = {
  update: (value: string) => void;
  destroy: () => void;
};

let monacoEnvironmentReady = false;
let themeDefined = false;
let modelCounter = 0;

const ensureMonacoEnvironment = () => {
  if (monacoEnvironmentReady) {
    return;
  }

  const monacoGlobal = globalThis as MonacoGlobal;
  if (!monacoGlobal.MonacoEnvironment?.getWorker) {
    monacoGlobal.MonacoEnvironment = {
      getWorker() {
        return new EditorWorker();
      },
    };
  }

  monacoEnvironmentReady = true;
};

const pageProxyMonacoThemeName = "page-proxy-dark";

const ensureLandingCodeEditorTheme = () => {
  if (themeDefined) {
    return;
  }

  const themeData = {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "93a1a1" },
      { token: "delimiter", foreground: "999999" },
      { token: "number", foreground: "ee9900" },
      { token: "string", foreground: "669900" },
      { token: "keyword", foreground: "ff8f3f" },
      { token: "operator", foreground: "a67f59" },
      { token: "type.identifier", foreground: "59C2FF" },
      { token: "function", foreground: "FCB253" },
      { token: "entity.name.function", foreground: "FCB253" },
      { token: "support.function", foreground: "FCB253" },
      { token: "identifier.function", foreground: "FCB253" },
      { token: "entity.name.type", foreground: "59C2FF" },
      { token: "identifier", foreground: "efe2d4" },
      { token: "delimiter.bracket", foreground: "999999" },
    ],
    semanticTokenColors: {
      class: "#59C2FF",
      interface: "#59C2FF",
      function: "#FCB253",
      method: "#FCB253",
    },
    colors: {
      "editor.background": "#282824",
      "editor.foreground": "#e7e8ea",
      "editorLineNumber.foreground": "#5c6e74",
      "editorLineNumber.activeForeground": "#e7e8ea",
      "editorCursor.foreground": "#e7e8ea",
      "editor.selectionBackground": "#b3d4fc55",
      "editor.inactiveSelectionBackground": "#b3d4fc33",
      editorLineHighlightBackground: "#00000000",
      "editorGutter.background": "#282824",
      "editorSuggestWidget.background": "#222121",
      "editorSuggestWidget.border": "#3f403a",
      "editorSuggestWidget.foreground": "#f2f3f2",
      "editorHoverWidget.background": "#222121",
      "editorHoverWidget.border": "#3f403a",
      "editorHoverWidget.foreground": "#f2f3f2",
      "editorHoverWidget.highlightForeground": "#FCB253",
      "textPreformat.foreground": "#f2f3f2",
      "textLink.foreground": "#59C2FF",
    },
  };

  monaco.editor.defineTheme(pageProxyMonacoThemeName, themeData as monaco.editor.IStandaloneThemeData);
  themeDefined = true;
};

const createModelUri = () => {
  modelCounter += 1;
  return monaco.Uri.parse(`file:///page-proxy/landing-example-${modelCounter}.js`);
};

export const createLandingMonacoPreview = (container: HTMLElement, value: string): LandingMonacoPreviewHandle => {
  ensureMonacoEnvironment();
  ensureLandingCodeEditorTheme();
  monaco.editor.setTheme(pageProxyMonacoThemeName);

  const model = monaco.editor.createModel(value, "javascript", createModelUri());
  const editor = monaco.editor.create(container, {
    model,
    automaticLayout: true,
    contextmenu: false,
    cursorBlinking: "solid",
    extraEditorClassName: "pp-monaco-editor",
    fontFamily:
      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontLigatures: true,
    fontSize: 14,
    glyphMargin: false,
    lineNumbers: "on",
    minimap: { enabled: false },
    overviewRulerBorder: false,
    padding: { top: 16, bottom: 16 },
    quickSuggestions: false,
    readOnly: true,
    renderLineHighlight: "none",
    roundedSelection: true,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    tabSize: 2,
    wordWrap: "on",
    wrappingIndent: "indent",
  });

  return {
    update(nextValue: string) {
      if (!model.isDisposed() && model.getValue() !== nextValue) {
        model.setValue(nextValue);
      }
      monaco.editor.setTheme(pageProxyMonacoThemeName);
    },
    destroy() {
      editor.dispose();
      model.dispose();
    },
  };
};
