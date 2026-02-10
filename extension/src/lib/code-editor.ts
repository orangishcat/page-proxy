import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import {
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
  javascriptDefaults
} from 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import { setupJavaScript } from 'monaco-editor/esm/vs/language/typescript/tsMode.js';
import 'monaco-editor/min/vs/editor/editor.main.css';
import ppModuleDeclarations from '@/types/pp-monaco-extra-lib.txt?raw';

const ppGlobalDeclarations = `
import * as pqModule from "@/lib/pp/pp-query";
import * as psModule from "@/lib/pp/pp-style";
import * as paModule from "@/lib/pp/pp-api";
import * as pvModule from "@/lib/pp/pp-event";

declare global {
  const pq: typeof pqModule;
  const ps: typeof psModule;
  const pa: typeof paModule;
  const pv: typeof pvModule;
}

export {};
`;

export type MonacoEditor = monaco.editor.IStandaloneCodeEditor;

export type MonacoCodeEditorHandle = {
  editor: MonacoEditor;
  model: monaco.editor.ITextModel;
  dispose: () => void;
};

type MonacoEnvironment = {
  getWorker?: (moduleId: string, label: string) => Worker;
};

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironment;
};

export type CreateMonacoEditorOptions = {
  readOnly?: boolean;
  lineNumbers?: 'on' | 'off';
  minimap?: boolean;
  wordWrap?: 'off' | 'on';
  modelUri?: string;
  className?: string;
  padding?: { top: number; bottom: number };
  onChange?: (value: string) => void;
  editorOptions?: monaco.editor.IStandaloneEditorConstructionOptions;
};

let monacoInitialized = false;
let monacoThemeDefined = false;
let ppTypesRegistered = false;
let jsLanguageConfigured = false;
let modelCounter = 0;

const ensureMonacoEnvironment = () => {
  const envGlobal = globalThis as MonacoGlobal;
  if (envGlobal.MonacoEnvironment?.getWorker) {
    return;
  }

  envGlobal.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url), {
          type: 'module'
        });
      }

      return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), {
        type: 'module'
      });
    }
  };
};

const defineTheme = () => {
  if (monacoThemeDefined) {
    return;
  }

  monaco.editor.defineTheme('page-proxy-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '93a1a1' },
      { token: 'delimiter', foreground: '999999' },
      { token: 'number', foreground: 'ee9900' },
      { token: 'string', foreground: '669900' },
      { token: 'keyword', foreground: 'ff8f3f' },
      { token: 'operator', foreground: 'a67f59' },
      { token: 'type.identifier', foreground: 'dd4a68' },
      { token: 'identifier', foreground: 'efe2d4' },
      { token: 'delimiter.bracket', foreground: '999999' }
    ],
    colors: {
      'editor.background': '#282824',
      'editor.foreground': '#5c6e74',
      'editorLineNumber.foreground': '#5c6e74',
      'editorLineNumber.activeForeground': '#e7e8ea',
      'editorCursor.foreground': '#e7e8ea',
      'editor.selectionBackground': '#b3d4fc55',
      'editor.inactiveSelectionBackground': '#b3d4fc33',
      'editorLineHighlightBackground': '#00000000',
      'editorGutter.background': '#282824',
      'editorSuggestWidget.background': '#222121',
      'editorSuggestWidget.border': '#3f403a',
      'editorSuggestWidget.foreground': '#f2f3f2',
      'editorHoverWidget.background': '#222121',
      'editorHoverWidget.border': '#3f403a'
    }
  });

  monacoThemeDefined = true;
};

const configureJavaScriptLanguageService = () => {
  if (jsLanguageConfigured) {
    return;
  }

  const defaults = javascriptDefaults;

  defaults.setEagerModelSync(true);
  defaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false
  });
  defaults.setCompilerOptions({
    target: ScriptTarget.ES2020,
    module: ModuleKind.ESNext,
    moduleResolution: ModuleResolutionKind.NodeJs,
    allowJs: true,
    checkJs: false,
    strict: true,
    noEmit: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    allowNonTsExtensions: true,
    baseUrl: 'file:///',
    paths: {
      '@/*': ['*']
    },
    lib: ['es2022', 'dom', 'dom.iterable']
  });

  if (!ppTypesRegistered) {
    defaults.addExtraLib(ppModuleDeclarations, 'file:///page-proxy/pp-modules.d.ts');
    defaults.addExtraLib(ppGlobalDeclarations, 'file:///page-proxy/pp-globals.d.ts');
    ppTypesRegistered = true;
  }

  setupJavaScript(defaults);
  jsLanguageConfigured = true;
};

export const ensureMonacoEditor = () => {
  if (monacoInitialized) {
    return;
  }

  ensureMonacoEnvironment();
  defineTheme();
  configureJavaScriptLanguageService();
  monaco.editor.setTheme('page-proxy-dark');
  monacoInitialized = true;
};

const createModelUri = (modelUri?: string) => {
  if (modelUri) {
    return monaco.Uri.parse(modelUri);
  }

  modelCounter += 1;
  return monaco.Uri.parse(`file:///page-proxy/editor-${modelCounter}.js`);
};

export const createMonacoEditor = (
  parent: HTMLElement,
  value: string,
  options: CreateMonacoEditorOptions = {},
): MonacoCodeEditorHandle => {
  ensureMonacoEditor();

  const {
    readOnly = false,
    lineNumbers = 'on',
    minimap = false,
    wordWrap = 'off',
    modelUri,
    className = 'pp-monaco-editor scrollbar-stable',
    padding = { top: 8, bottom: 8 },
    onChange,
    editorOptions = {}
  } = options;

  const model = monaco.editor.createModel(value, 'javascript', createModelUri(modelUri));
  const editor = monaco.editor.create(parent, {
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
    renderWhitespace: 'selection',
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    snippetSuggestions: 'inline',
    parameterHints: { enabled: true },
    inlineSuggest: { enabled: true },
    'semanticHighlighting.enabled': true,
    bracketPairColorization: { enabled: true },
    scrollBeyondLastLine: false,
    lineDecorationsWidth: lineNumbers === 'off' ? 0 : 10,
    lineNumbersMinChars: lineNumbers === 'off' ? 0 : 3,
    padding,
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 13,
    lineHeight: 20,
    ...editorOptions
  });
  const rootNode = editor.getDomNode();
  if (rootNode instanceof HTMLElement) {
    className
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .forEach((token) => {
        rootNode.classList.add(token);
      });
  }

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
    }
  };
};

export const updateMonacoEditorValue = (handle: MonacoCodeEditorHandle, value: string) => {
  if (handle.model.isDisposed()) {
    return;
  }

  handle.model.setValue(value);
};

export const getMonacoEditorValue = (handle: MonacoCodeEditorHandle) =>
  handle.model.isDisposed() ? '' : handle.model.getValue();

export const MonacoRange = monaco.Range;
