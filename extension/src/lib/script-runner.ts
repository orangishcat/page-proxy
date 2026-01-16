export type ScriptRunRequest = {
  type: 'script:run';
  requestId: string;
  code: string;
};

export type ScriptRunResponse = {
  type: 'script:result';
  requestId: string;
  error: string | null;
};

export type ScriptRunResult = {
  errors: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isScriptRunRequest = (value: unknown): value is ScriptRunRequest => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === 'script:run' &&
    typeof value.requestId === 'string' &&
    typeof value.code === 'string'
  );
};

export const isScriptRunResponse = (value: unknown): value is ScriptRunResponse => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === 'script:result' &&
    typeof value.requestId === 'string' &&
    (value.error === null || typeof value.error === 'string')
  );
};

export const buildScriptRunResponse = (
  requestId: string,
  error: string | null
): ScriptRunResponse => ({
  type: 'script:result',
  requestId,
  error
});
