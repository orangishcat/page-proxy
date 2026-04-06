import { runNetworkFetch, createMethodFetch } from "./_core";
import type { NetworkFetchInput, NetworkFetchOptions } from "./_core";
import { invalidateCache } from "./invalidateCache";
import type { RawStorageAdapter } from "../pp-storage";

export const createNetwork = (scopeOverride?: string, adapter?: RawStorageAdapter) => ({
  fetch: (input: NetworkFetchInput, options: NetworkFetchOptions = {}) =>
    runNetworkFetch(input, options, scopeOverride, adapter),
  invalidateCache: (key: string) => invalidateCache(key, scopeOverride, adapter),
  get: createMethodFetch("GET", scopeOverride, adapter),
  head: createMethodFetch("HEAD", scopeOverride, adapter),
  post: createMethodFetch("POST", scopeOverride, adapter),
  put: createMethodFetch("PUT", scopeOverride, adapter),
  delete: createMethodFetch("DELETE", scopeOverride, adapter),
  connect: createMethodFetch("CONNECT", scopeOverride, adapter),
  options: createMethodFetch("OPTIONS", scopeOverride, adapter),
  trace: createMethodFetch("TRACE", scopeOverride, adapter),
  patch: createMethodFetch("PATCH", scopeOverride, adapter),
});
