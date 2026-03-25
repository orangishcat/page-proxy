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

const getThemeName = () => (document.documentElement.classList.contains("dark") ? "vs-dark" : "vs");

const createModelUri = () => {
  modelCounter += 1;
  return monaco.Uri.parse(`file:///page-proxy/landing-example-${modelCounter}.js`);
};

export const createLandingMonacoPreview = (container: HTMLElement, value: string): LandingMonacoPreviewHandle => {
  ensureMonacoEnvironment();
  monaco.editor.setTheme(getThemeName());

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
      monaco.editor.setTheme(getThemeName());
    },
    destroy() {
      editor.dispose();
      model.dispose();
    },
  };
};
