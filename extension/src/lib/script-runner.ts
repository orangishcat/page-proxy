export type ScriptRunRequest = {
  type: 'script:run';
  requestId: string;
  code: string;
};

export type ScriptRunLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'notification';

export type ScriptRunLogValue =
  | {kind: 'null'}
  | {kind: 'undefined'}
  | {kind: 'string'; value: string}
  | {kind: 'number'; value: number}
  | {kind: 'boolean'; value: boolean}
  | {kind: 'bigint'; value: string}
  | {kind: 'symbol'; value: string}
  | {kind: 'function'; name: string}
  | {kind: 'date'; value: string}
  | {kind: 'regexp'; value: string}
  | {kind: 'error'; name: string; message: string; stack: string | null}
  | {kind: 'array'; items: ScriptRunLogValue[]; truncated: boolean}
  | {
      kind: 'object';
      constructorName: string | null;
      entries: Array<{key: string; value: ScriptRunLogValue}>;
      truncated: boolean;
    }
  | {kind: 'accessor'; description: string}
  | {kind: 'circular'};

export type ScriptRunLogEntry = {
  level: ScriptRunLogLevel;
  values: ScriptRunLogValue[];
  timestamp: number;
};

export type ScriptRunResponse = {
  type: 'script:result';
  requestId: string;
  error: string | null;
  logs: ScriptRunLogEntry[];
  selectors: ScriptRunSelectorEntry[];
};

export type ScriptRunResult = {
  errors: string[];
  logs: ScriptRunLogEntry[];
  selectors: ScriptRunSelectorEntry[];
};

export type ScriptRunSelectorEntry = {
  name: string;
  ruleKeys: string[];
  rules: string[];
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

  const selectors = value.selectors;
  const hasValidSelectors =
    (Array.isArray(selectors) &&
      selectors.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.name === 'string' &&
          Array.isArray(entry.ruleKeys) &&
          entry.ruleKeys.every((ruleKey) => typeof ruleKey === 'string') &&
          Array.isArray(entry.rules) &&
          entry.rules.every((rule) => typeof rule === 'string')
      )) ||
    selectors === undefined;

  const logs = value.logs;
  const hasValidLogs =
    (Array.isArray(logs) &&
      logs.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.level === 'string' &&
          Array.isArray(entry.values) &&
          typeof entry.timestamp === 'number'
      )) ||
    logs === undefined;

  return (
    value.type === 'script:result' &&
    typeof value.requestId === 'string' &&
    (value.error === null || typeof value.error === 'string') &&
    hasValidLogs &&
    hasValidSelectors
  );
};

export const buildScriptRunResponse = (
  requestId: string,
  error: string | null,
  logs: ScriptRunLogEntry[] = [],
  selectors: ScriptRunSelectorEntry[] = []
): ScriptRunResponse => ({
  type: 'script:result',
  requestId,
  error,
  logs,
  selectors
});
