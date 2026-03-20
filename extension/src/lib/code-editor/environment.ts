import editorWorkerUrl from "monaco-editor/esm/vs/editor/editor.worker?worker&url";
import tsWorkerUrl from "monaco-editor/esm/vs/language/typescript/ts.worker?worker&url";

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

const resolveWorkerUrl = (workerUrl: string) => {
  const assetPath = workerUrl.startsWith("/") ? workerUrl.slice(1) : workerUrl;
  return chrome.runtime.getURL(assetPath);
};

const createWorker = (label: string) => {
  try {
    const workerUrl = label === "typescript" || label === "javascript" ? tsWorkerUrl : editorWorkerUrl;
    const worker = new Worker(resolveWorkerUrl(workerUrl), { name: label, type: "module" });
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
