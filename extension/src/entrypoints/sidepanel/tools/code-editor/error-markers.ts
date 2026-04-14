import {
  clearMonacoEditorMarkers,
  setMonacoEditorMarkers,
  type MonacoCodeEditorHandle,
  type MonacoEditorMarker,
} from "../../../../lib/code-editor";

const scriptRunErrorMarkerOwner = "script-run-error";
const scriptLocationPattern = /(?:<script>|blob:[^\s)]+):(\d+)(?::(\d+))?/;

export const getScriptLocation = (text: string | null): { lineNumber: number; column: number } | null => {
  if (!text) {
    return null;
  }

  const match = text.match(scriptLocationPattern);
  if (!match) {
    return null;
  }

  const lineNumber = Number.parseInt(match[1] ?? "", 10);
  if (Number.isNaN(lineNumber) || lineNumber < 1) {
    return null;
  }

  const column = Number.parseInt(match[2] ?? "1", 10);
  if (Number.isNaN(column) || column < 1) {
    return null;
  }

  return { lineNumber, column };
};

export const buildScriptRunErrorMarker = (
  editorHandle: MonacoCodeEditorHandle,
  message: string,
  stackTrace: string | null,
): MonacoEditorMarker | null => {
  if (editorHandle.model.isDisposed()) {
    return null;
  }

  const location = getScriptLocation(stackTrace) ?? getScriptLocation(message);
  if (!location) {
    return null;
  }

  const lineCount = editorHandle.model.getLineCount();
  const startLineNumber = Math.min(Math.max(location.lineNumber, 1), lineCount);
  const lineMaxColumn = editorHandle.model.getLineMaxColumn(startLineNumber);
  const startColumn = Math.min(Math.max(location.column, 1), lineMaxColumn);
  const endColumn = lineMaxColumn > startColumn ? startColumn + 1 : startColumn;

  return {
    message,
    startLineNumber,
    startColumn,
    endLineNumber: startLineNumber,
    endColumn,
    severity: "error",
  };
};

export const clearScriptRunErrorMarker = (editorHandle: MonacoCodeEditorHandle | null): void => {
  if (!editorHandle) {
    return;
  }
  clearMonacoEditorMarkers(editorHandle, scriptRunErrorMarkerOwner);
};

export const applyScriptRunErrorMarker = (
  editorHandle: MonacoCodeEditorHandle | null,
  message: string,
  stackTrace: string | null,
): void => {
  if (!editorHandle) {
    return;
  }

  const marker = buildScriptRunErrorMarker(editorHandle, message, stackTrace);
  if (!marker) {
    clearScriptRunErrorMarker(editorHandle);
    return;
  }

  setMonacoEditorMarkers(editorHandle, scriptRunErrorMarkerOwner, [marker]);
};
