export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ElementEntry = {
  name: string;
  selector: string;
  bbox: BoundingBox;
  attributes: Record<string, string>;
};

export type SelectorPropertyFilters = {
  contains: Record<string, string>;
  matches: Record<string, string>;
  keyOnly: string[];
};

export type SelectorEntry = {
  name: string;
  selector: string;
  bbox?: BoundingBox;
  properties: SelectorPropertyFilters;
};

export type SandboxEvaluateRequest = {
  type: 'sandbox:evaluate';
  requestId: string;
  code: string;
};

export type SandboxEvaluateResponse = {
  type: 'sandbox:result';
  requestId: string;
  elements: ElementEntry[];
  selectors: SelectorEntry[];
  errors: string[];
};

export type SandboxResult = Omit<SandboxEvaluateResponse, 'type' | 'requestId'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isSandboxRequest = (value: unknown): value is SandboxEvaluateRequest => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === 'sandbox:evaluate' &&
    typeof value.requestId === 'string' &&
    typeof value.code === 'string'
  );
};

export const isSandboxResponse = (value: unknown): value is SandboxEvaluateResponse => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === 'sandbox:result' &&
    typeof value.requestId === 'string' &&
    Array.isArray(value.elements) &&
    Array.isArray(value.selectors) &&
    Array.isArray(value.errors)
  );
};

export const buildSandboxErrorResponse = (
  requestId: string,
  message: string
): SandboxEvaluateResponse => ({
  type: 'sandbox:result',
  requestId,
  elements: [],
  selectors: [],
  errors: [message]
});
