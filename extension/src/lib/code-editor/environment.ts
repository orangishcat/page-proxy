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
        return new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker.js", import.meta.url), {
          type: "module",
        });
      }

      return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), {
        type: "module",
      });
    },
  };
};
