import editorWorkerInline from "monaco-editor/editor/editor.worker?worker&inline";
import editorWorkerUrl from "monaco-editor/editor/editor.worker?worker&url";
import tsWorkerInline from "monaco-editor/language/typescript/ts.worker?worker&inline";
import tsWorkerUrl from "monaco-editor/language/typescript/ts.worker?worker&url";

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
    message: (error as { message: unknown }).message ?? String(error),
  };
  console.error("Monaco worker error", detail);
  globalThis.dispatchEvent(new CustomEvent(MONACO_WORKER_ERROR_EVENT, { detail }));
};

const resolveWorkerUrl = (workerUrl: string) => {
  const assetPath = workerUrl.startsWith("/") ? workerUrl.slice(1) : workerUrl;
  return chrome.runtime.getURL(assetPath);
};

const isExtensionPage = () => location.protocol === "chrome-extension:" || location.protocol === "moz-extension:";

const attachWorkerErrorListeners = (worker: Worker, label: string) => {
  worker.addEventListener("error", (event: ErrorEvent) => {
    notifyWorkerError(label, event.error ?? event.message ?? event);
  });
  worker.addEventListener("messageerror", (event: MessageEvent<unknown>) => {
    notifyWorkerError(label, event);
  });
  return worker;
};

const createInlineWorker = (label: string) => {
  const WorkerFactory = label === "typescript" || label === "javascript" ? tsWorkerInline : editorWorkerInline;
  return attachWorkerErrorListeners(new WorkerFactory({ name: label }), label);
};

const createURLWorker = (label: string) => {
  const workerUrl = label === "typescript" || label === "javascript" ? tsWorkerUrl : editorWorkerUrl;
  return attachWorkerErrorListeners(new Worker(resolveWorkerUrl(workerUrl), { name: label, type: "module" }), label);
};

const createWorker = (label: string) => {
  try {
    // idk keep it like this
    return isExtensionPage() && import.meta.env.BROWSER === "firefox"
      ? createURLWorker(label)
      : createInlineWorker(label);
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
