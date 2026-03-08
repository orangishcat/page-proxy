import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker&inline";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline";

export const MONACO_WORKER_ERROR_EVENT = "pp:monaco-worker-error";

type MonacoEnvironment = {
  getWorker?: (moduleId: string, label: string) => Worker;
};

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironment;
};

const notifyWorkerError = (label: string, error: unknown) => {
  const detail = {
    label,
    message: error instanceof Error ? error.message : "Unknown Monaco worker error",
  };
  console.error("Monaco worker error", detail);
  globalThis.dispatchEvent(new CustomEvent(MONACO_WORKER_ERROR_EVENT, { detail }));
};

const createWorker = (label: string) => {
  try {
    const worker = label === "typescript" || label === "javascript" ? new tsWorker() : new editorWorker();
    worker.addEventListener("error", (event: ErrorEvent) => {
      notifyWorkerError(label, event.error ?? event.message ?? event);
    });
    worker.addEventListener("messageerror", (event: MessageEvent<unknown>) => {
      notifyWorkerError(label, event);
    });
    return worker;
  } catch (error: unknown) {
    notifyWorkerError(label, error);
    throw error;
  }
};

export const ensureMonacoEnvironment = () => {
  const envGlobal = globalThis as MonacoGlobal;
  if (envGlobal.MonacoEnvironment?.getWorker) {
    return;
  }

  envGlobal.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      return createWorker(label);
    },
  };
};
