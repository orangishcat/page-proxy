import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

type MonacoEnvironment = {
  getWorker?: (moduleId: string, label: string) => Worker;
};

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironment;
};

export const ensureMonacoEnvironment = () => {
  const envGlobal = globalThis as MonacoGlobal;
  if (envGlobal.MonacoEnvironment?.getWorker) {
    return;
  }

  envGlobal.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === "typescript" || label === "javascript") {
        return new tsWorker();
      }

      return new editorWorker();
    },
  };
};
