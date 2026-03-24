import { applyScriptRunErrorMarker, clearScriptRunErrorMarker } from "./error-markers";
import type { MonacoCodeEditorHandle } from "@/lib/code-editor";

export type UpdateRunErrorDeps = {
  getLastRunError: () => string | null;
  setLastRunError: (v: string | null) => void;
  getLastRunErrorStack: () => string | null;
  setLastRunErrorStack: (v: string | null) => void;
  getEditorMessage: () => { text: string; status: string } | null;
  setEditorMessage: (msg: string | null, status: "success" | "error", stack?: string | null) => void;
  getEditorHandle: () => MonacoCodeEditorHandle | null;
};

export type RunScriptDeps = UpdateRunErrorDeps & {
  getIsRunning: () => boolean;
  setIsRunning: (v: boolean) => void;
  getActiveScriptName: () => string | null;
  saveNow: (content: string) => void;
  getDefinitionBlock: (content: string) => string;
  setEditorMessageFromUnknown: (err: unknown, fallback: string) => void;
  parseScriptMetadata: (content: string) => unknown;
  requestScriptRun: (content: string, scriptName: string) => Promise<{ errors: string[]; errorStacks: string[] }>;
};

export const updateRunError = (errors: string[], errorStacks: string[] = [], deps: UpdateRunErrorDeps): void => {
  if (errors.length === 0) {
    if (
      deps.getLastRunError() &&
      deps.getEditorMessage()?.status === "error" &&
      deps.getEditorMessage()?.text === deps.getLastRunError()
    ) {
      deps.setEditorMessage(null, "error");
    }
    deps.setLastRunError(null);
    deps.setLastRunErrorStack(null);
    clearScriptRunErrorMarker(deps.getEditorHandle());
    deps.setEditorMessage("Script execution succeeded", "success");
    return;
  }

  const message = errors.find((value) => value.trim().length > 0) ?? "Script execution failed.";
  const stackTrace = errorStacks.find((value) => value.trim().length > 0) ?? null;
  deps.setLastRunError(message);
  deps.setLastRunErrorStack(stackTrace);
  deps.setEditorMessage(message, "error", stackTrace);
  applyScriptRunErrorMarker(deps.getEditorHandle(), message, stackTrace);
};

export const handleRunFailure = (error: unknown, deps: UpdateRunErrorDeps): void => {
  const message = error instanceof Error ? error.message.trim() : String(error).trim();
  const errorStack = error instanceof Error && typeof error.stack === "string" ? error.stack : null;
  updateRunError([message || "Script execution failed."], errorStack ? [errorStack] : [], deps);
};

export const runScript = (editorValue: string, deps: RunScriptDeps): void => {
  if (deps.getIsRunning()) {
    return;
  }

  if (deps.getEditorMessage()?.status === "success") {
    deps.setEditorMessage(null, "success");
  }

  if (!editorValue.trim()) {
    deps.setEditorMessage("Script is empty.", "error");
    return;
  }

  deps.setIsRunning(true);
  deps.saveNow(editorValue);
  const resolvedScriptName = deps.getActiveScriptName()?.trim() || (deps.parseScriptMetadata(editorValue) as { title?: string }).title?.trim() || "Page Proxy";
  void deps
    .requestScriptRun(editorValue, resolvedScriptName)
    .then((result) => {
      deps.saveNow(editorValue);
      updateRunError(result.errors, result.errorStacks, deps);
    })
    .catch((error: unknown) => {
      handleRunFailure(error, deps);
    })
    .finally(() => {
      deps.setIsRunning(false);
    });
};
