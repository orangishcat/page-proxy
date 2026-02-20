import {
  getRawItem,
  networkCacheKeyPrefix,
  removeRawItem,
  setRawItem,
  toNetworkCacheStorageKey,
} from "./pp-storage";

type NetworkRequestMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "DELETE"
  | "CONNECT"
  | "OPTIONS"
  | "TRACE"
  | "PATCH";

type NetworkFetchInput = RequestInfo | URL;

const defaultNetworkCacheDurationMs = 24 * 60 * 60 * 1000;
const maxCachedResponseBytes = 512 * 1024;

export type NetworkFetchOptions = Omit<RequestInit, "cache"> & {
  cache?: boolean;
  cacheDuration?: number;
  cacheKey?: string;
  requestCache?: RequestCache;
};

export type NetworkMethodOptions = Omit<NetworkFetchOptions, "method">;

type StoredCacheEntry = {
  createdAt: number;
  expiresAt: number;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  bodyBase64: string;
  bodySize: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isHeaderEntryArray = (value: unknown): value is Array<[string, string]> =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string",
  );

const normalizeMethod = (method: string | undefined): NetworkRequestMethod => {
  const normalizedMethod = (method ?? "GET").trim().toUpperCase();
  switch (normalizedMethod) {
    case "GET":
    case "HEAD":
    case "POST":
    case "PUT":
    case "DELETE":
    case "CONNECT":
    case "OPTIONS":
    case "TRACE":
    case "PATCH":
      return normalizedMethod;
    default:
      return "GET";
  }
};

const normalizeCacheDuration = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return defaultNetworkCacheDurationMs;
  }

  return Math.floor(value);
};

const toResponseBodyBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const fromResponseBodyBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const parseStoredCacheEntry = (value: string | null): StoredCacheEntry | null => {
  if (!value) {
    return null;
  }

  const parsedValue = JSON.parse(value) as unknown;
  if (!isRecord(parsedValue)) {
    return null;
  }

  if (
    typeof parsedValue.createdAt !== "number" ||
    !Number.isFinite(parsedValue.createdAt) ||
    typeof parsedValue.expiresAt !== "number" ||
    !Number.isFinite(parsedValue.expiresAt) ||
    typeof parsedValue.status !== "number" ||
    !Number.isFinite(parsedValue.status) ||
    typeof parsedValue.statusText !== "string" ||
    !isHeaderEntryArray(parsedValue.headers) ||
    typeof parsedValue.bodyBase64 !== "string" ||
    typeof parsedValue.bodySize !== "number" ||
    !Number.isFinite(parsedValue.bodySize)
  ) {
    return null;
  }

  return {
    createdAt: parsedValue.createdAt,
    expiresAt: parsedValue.expiresAt,
    status: parsedValue.status,
    statusText: parsedValue.statusText,
    headers: parsedValue.headers,
    bodyBase64: parsedValue.bodyBase64,
    bodySize: parsedValue.bodySize,
  };
};

const readStoredCacheEntry = (storageKey: string) => {
  const entry = parseStoredCacheEntry(getRawItem(storageKey));
  if (!entry) {
    removeRawItem(storageKey);
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    removeRawItem(storageKey);
    return null;
  }

  return entry;
};

const buildResponseFromCache = (entry: StoredCacheEntry) =>
  new Response(fromResponseBodyBase64(entry.bodyBase64), {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });

const buildFetchRequestInit = (options: NetworkFetchOptions, methodOverride?: NetworkRequestMethod): RequestInit => {
  const { cache: _cache, cacheDuration: _cacheDuration, cacheKey: _cacheKey, requestCache, ...requestInit } = options;
  const resolvedMethod = methodOverride ?? normalizeMethod(requestInit.method);

  return {
    ...requestInit,
    method: resolvedMethod,
    cache: requestCache,
  };
};

const shouldUseCache = (options: NetworkFetchOptions) => options.cache === true;

const persistCacheEntry = async (storageKey: string, response: Response, cacheDuration: number, scopeOverride?: string) => {
  const responseClone = response.clone();
  const responseBuffer = await responseClone.arrayBuffer();
  const bodySize = responseBuffer.byteLength;
  if (bodySize >= maxCachedResponseBytes) {
    return;
  }

  const now = Date.now();
  const entry: StoredCacheEntry = {
    createdAt: now,
    expiresAt: now + cacheDuration,
    status: responseClone.status,
    statusText: responseClone.statusText,
    headers: Array.from(responseClone.headers.entries()),
    bodyBase64: toResponseBodyBase64(responseBuffer),
    bodySize,
  };

  setRawItem(storageKey, JSON.stringify(entry), {
    scope: scopeOverride,
    enforceLimit: true,
  });
};

const buildCacheIdentity = (request: Request, cacheKey: string | undefined) => {
  const normalizedCacheKey = cacheKey?.trim();
  if (normalizedCacheKey && normalizedCacheKey.length > 0) {
    return normalizedCacheKey;
  }

  return request.url;
};

const runNetworkFetch = async (input: NetworkFetchInput, options: NetworkFetchOptions = {}, scopeOverride?: string) => {
  const requestInit = buildFetchRequestInit(options);
  const request = new Request(input, requestInit);

  if (!shouldUseCache(options)) {
    return globalThis.fetch(request);
  }

  const cacheDuration = normalizeCacheDuration(options.cacheDuration);
  const cacheIdentity = buildCacheIdentity(request, options.cacheKey);
  const storageKey = toNetworkCacheStorageKey(cacheIdentity, scopeOverride);
  const cachedEntry = readStoredCacheEntry(storageKey);
  if (cachedEntry) {
    return buildResponseFromCache(cachedEntry);
  }

  const response = await globalThis.fetch(request);
  await persistCacheEntry(storageKey, response, cacheDuration, scopeOverride);
  return response;
};

const createMethodFetch =
  (method: NetworkRequestMethod, scopeOverride?: string) =>
  (input: NetworkFetchInput, options: NetworkMethodOptions = {}) =>
    runNetworkFetch(
      input,
      {
        ...options,
        method,
      },
      scopeOverride,
    );

export const createNetwork = (scopeOverride?: string) => ({
  fetch: (input: NetworkFetchInput, options: NetworkFetchOptions = {}) => runNetworkFetch(input, options, scopeOverride),
  get: createMethodFetch("GET", scopeOverride),
  head: createMethodFetch("HEAD", scopeOverride),
  post: createMethodFetch("POST", scopeOverride),
  put: createMethodFetch("PUT", scopeOverride),
  delete: createMethodFetch("DELETE", scopeOverride),
  connect: createMethodFetch("CONNECT", scopeOverride),
  options: createMethodFetch("OPTIONS", scopeOverride),
  trace: createMethodFetch("TRACE", scopeOverride),
  patch: createMethodFetch("PATCH", scopeOverride),
});

export const fetch = (input: NetworkFetchInput, options: NetworkFetchOptions = {}) => runNetworkFetch(input, options);
export const get = createMethodFetch("GET");
export const head = createMethodFetch("HEAD");
export const post = createMethodFetch("POST");
export const put = createMethodFetch("PUT");
const del = createMethodFetch("DELETE");
export { del as delete };
export const connect = createMethodFetch("CONNECT");
export const options = createMethodFetch("OPTIONS");
export const trace = createMethodFetch("TRACE");
export const patch = createMethodFetch("PATCH");

export { networkCacheKeyPrefix };
