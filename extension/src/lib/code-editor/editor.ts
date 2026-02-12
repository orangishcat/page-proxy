import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import "monaco-editor/esm/vs/editor/edcore.main.js";
import type { CreateMonacoEditorOptions, MonacoCodeEditorHandle } from "./types";
import { ensureMonacoEnvironment } from "./environment";
import { configureJavaScriptLanguageService } from "./language-service";
import { ensureCodeEditorTheme, pageProxyMonacoThemeName } from "./theme";
import { buildEditorConstructionOptions } from "./editor-options";

let monacoInitialized = false;
let modelCounter = 0;

const createModelUri = (modelUri?: string) => {
  if (modelUri) {
    return monaco.Uri.parse(modelUri);
  }

  modelCounter += 1;
  return monaco.Uri.parse(`file:///page-proxy/editor-${modelCounter}.js`);
};

const applyEditorClassNames = (editor: monaco.editor.IStandaloneCodeEditor, className: string) => {
  const rootNode = editor.getDomNode();
  if (!(rootNode instanceof HTMLElement)) {
    return;
  }

  className
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .forEach((token) => {
      rootNode.classList.add(token);
    });
};

export const ensureMonacoEditor = () => {
  if (monacoInitialized) {
    return;
  }

  ensureMonacoEnvironment();
  ensureCodeEditorTheme();
  configureJavaScriptLanguageService();
  monaco.editor.setTheme(pageProxyMonacoThemeName);
  monacoInitialized = true;
};

export const createMonacoEditor = (
  parent: HTMLElement,
  value: string,
  options: CreateMonacoEditorOptions = {},
): MonacoCodeEditorHandle => {
  ensureMonacoEditor();

  const {
    readOnly = false,
    lineNumbers = "on",
    minimap = false,
    wordWrap = "off",
    modelUri,
    className = "pp-monaco-editor scrollbar-stable",
    padding = { top: 8, bottom: 8 },
    onChange,
    editorOptions = {},
  } = options;

  const model = monaco.editor.createModel(value, "javascript", createModelUri(modelUri));
  const editor = monaco.editor.create(
    parent,
    buildEditorConstructionOptions({
      model,
      readOnly,
      lineNumbers,
      minimap,
      wordWrap,
      padding,
      editorOptions,
    }),
  );

  applyEditorClassNames(editor, className);

  const disposables: monaco.IDisposable[] = [];
  if (onChange) {
    disposables.push(
      editor.onDidChangeModelContent(() => {
        onChange(editor.getValue());
      }),
    );
  }

  return {
    editor,
    model,
    dispose: () => {
      disposables.forEach((disposable) => {
        disposable.dispose();
      });
      editor.dispose();
      model.dispose();
    },
  };
};

export const updateMonacoEditorValue = (handle: MonacoCodeEditorHandle, value: string) => {
  if (handle.model.isDisposed()) {
    return;
  }

  handle.model.setValue(value);
};

export const getMonacoEditorValue = (handle: MonacoCodeEditorHandle) =>
  handle.model.isDisposed() ? "" : handle.model.getValue();

export const MonacoRange = monaco.Range;
