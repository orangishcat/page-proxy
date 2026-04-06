import {
  getRawItem,
  removeRawItem,
  setRawItem,
  toNetworkCacheStorageKey,
} from "../pp-storage";
import type { RawStorageAdapter } from "../pp-storage";

export type NetworkRequestMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE" | "PATCH";
export type NetworkFetchInput = RequestInfo | URL;

export type NetworkFetchOptions = Omit<RequestInit, "cache"> & {
  cache?: boolean;
  cacheDuration?: number;
  cacheKey?: string;
  requestCache?: RequestCache;
};

export type NetworkMethodOptions = Omit<NetworkFetchOptions, "method">;

const defaultNetworkCacheDurationMs = 24 * 60 * 60 * 1000;
const maxCachedResponseBytes = 512 * 1024;

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
      Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string",
  );

export const normalizeMethod = (method: string | undefined): NetworkRequestMethod => {
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

const readStoredCacheEntry = (storageKey: string, adapter?: RawStorageAdapter) => {
  const entry = parseStoredCacheEntry(getRawItem(storageKey, adapter));
  if (!entry) {
    removeRawItem(storageKey, adapter);
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    removeRawItem(storageKey, adapter);
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
  const { requestCache, ...requestInit } = options;
  const resolvedMethod = methodOverride ?? normalizeMethod(requestInit.method);

  return {
    ...requestInit,
    method: resolvedMethod,
    cache: requestCache,
  };
};

const shouldUseCache = (options: NetworkFetchOptions) => options.cache === true;

const persistCacheEntry = async (
  storageKey: string,
  response: Response,
  cacheDuration: number,
  scopeOverride?: string,
  adapter?: RawStorageAdapter,
) => {
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
  }, adapter);
};

const buildCacheIdentity = (request: Request, cacheKey: string | undefined) => {
  const normalizedCacheKey = cacheKey?.trim();
  if (normalizedCacheKey && normalizedCacheKey.length > 0) {
    return normalizedCacheKey;
  }

  return request.url;
};

export const buildCacheStorageKeysForInvalidate = (key: string, scopeOverride?: string) => {
  const normalizedKey = key.trim();
  if (normalizedKey.length === 0) {
    return [] as string[];
  }

  const storageKeys = [toNetworkCacheStorageKey(normalizedKey, scopeOverride)];
  const baseHref = typeof globalThis.location?.href === "string" ? globalThis.location.href : undefined;
  const canParseUrl =
    typeof URL !== "undefined" && typeof URL.canParse === "function" && URL.canParse(normalizedKey, baseHref);

  if (!canParseUrl) {
    return storageKeys;
  }

  const normalizedUrl = new URL(normalizedKey, baseHref).href;
  const request = new Request(normalizedUrl);
  const normalizedUrlIdentity = buildCacheIdentity(request, undefined);
  const normalizedUrlStorageKey = toNetworkCacheStorageKey(normalizedUrlIdentity, scopeOverride);

  if (normalizedUrlStorageKey !== storageKeys[0]) {
    storageKeys.push(normalizedUrlStorageKey);
  }

  return storageKeys;
};

export const runNetworkFetch = async (
  input: NetworkFetchInput,
  options: NetworkFetchOptions = {},
  scopeOverride?: string,
  adapter?: RawStorageAdapter,
) => {
  const requestInit = buildFetchRequestInit(options);
  const request = new Request(input, requestInit);

  if (!shouldUseCache(options)) {
    return globalThis.fetch(request);
  }

  const cacheDuration = normalizeCacheDuration(options.cacheDuration);
  const cacheIdentity = buildCacheIdentity(request, options.cacheKey);
  const storageKey = toNetworkCacheStorageKey(cacheIdentity, scopeOverride);
  const cachedEntry = readStoredCacheEntry(storageKey, adapter);
  if (cachedEntry) {
    return buildResponseFromCache(cachedEntry);
  }

  const response = await globalThis.fetch(request);
  await persistCacheEntry(storageKey, response, cacheDuration, scopeOverride, adapter);
  return response;
};

export const createMethodFetch =
  (method: NetworkRequestMethod, scopeOverride?: string, adapter?: RawStorageAdapter) =>
  (input: NetworkFetchInput, options: NetworkMethodOptions = {}) =>
    runNetworkFetch(
      input,
      {
        ...options,
        method,
      },
      scopeOverride,
      adapter,
    );
