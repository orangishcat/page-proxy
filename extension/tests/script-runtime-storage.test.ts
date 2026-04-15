import { afterEach, describe, expect, mock, test } from "bun:test";

import { createNetwork } from "@page-proxy/pp/pp-network";
import { createStorage } from "@page-proxy/pp/pp-storage";
import {
  buildScriptRunResponse,
  isScriptRunRequest,
  isScriptRunResponse,
  type ScriptRunRequest,
} from "../src/lib/script-runner";
import { coerceStoredToolState, type StoredToolState } from "../src/lib/stored-tool-state";
import {
  cloneStoredRuntimeStorage,
  createEmptyStoredRuntimeStorage,
  createStoredRuntimeStorageAdapter,
} from "../src/lib/script-runtime-storage";

const runtimeStorage = {
  pt: {
    "pp-storage:global:token": "secret",
  },
  pn: {
    "pp-network-cache:global:https://api.example.com/items": JSON.stringify({
      createdAt: 1,
      expiresAt: 2,
      status: 200,
      statusText: "OK",
      headers: [["content-type", "application/json"]],
      bodyBase64: "e30=",
      bodySize: 2,
    }),
  },
};

const buildStoredState = (): StoredToolState => ({
  scriptName: "Page Proxy",
  activeTool: "none",
  codeEditor: {
    content: [
      "// ==Page Proxy==",
      "// @title Page Proxy",
      "// @website https://example.com/*",
      "// @description",
      "// @author",
      "// @grant",
      "// ==/Page Proxy==",
      "",
      "// ==Selectors==",
      "// ==/Selectors==",
      "",
    ].join("\n"),
  },
  selectorPanel: {
    entries: [],
  },
  permissions: {
    allowedGrants: [],
    enabled: true,
  },
  websiteGlob: "https://example.com/*",
  updatedAt: 1,
  runtimeStorage,
});

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("script runtime storage", () => {
  test("coerces stored runtime storage from extension storage state", () => {
    const state = coerceStoredToolState(buildStoredState(), "Page Proxy");

    expect(state?.runtimeStorage).toEqual(runtimeStorage);
  });

  test("defaults invalid runtime storage to empty maps", () => {
    const state = coerceStoredToolState(
      {
        ...buildStoredState(),
        runtimeStorage: {
          pt: {
            valid: "value",
            invalid: 1,
          },
          pn: "nope",
        },
      },
      "Page Proxy",
    );

    expect(state?.runtimeStorage).toEqual({
      pt: {
        valid: "value",
      },
      pn: {},
    });
  });

  test("coerces stored permissions without a global disable flag", () => {
    const state = coerceStoredToolState(buildStoredState(), "Page Proxy");

    expect(state?.permissions.allowedGrants).toEqual([]);
    expect(state?.permissions.enabled).toBe(true);
  });

  test("coerces object-shaped stored permissions grants into a list", () => {
    const state = coerceStoredToolState(
      {
        ...buildStoredState(),
        permissions: {
          allowedGrants: {
            0: "run-on-page-load",
          },
          enabled: true,
        },
      },
      "Page Proxy",
    );

    expect(state?.permissions.allowedGrants).toEqual(["run-on-page-load"]);
  });

  test("defaults missing per-script enabled to true", () => {
    const state = coerceStoredToolState(
      {
        ...buildStoredState(),
        permissions: {
          allowedGrants: [],
        },
      },
      "Page Proxy",
    );

    expect(state?.permissions.enabled).toBe(true);
  });

  test("coerces stored per-script enabled state", () => {
    const state = coerceStoredToolState(
      {
        ...buildStoredState(),
        permissions: {
          allowedGrants: [],
          enabled: false,
        },
      },
      "Page Proxy",
    );

    expect(state?.permissions.enabled).toBe(false);
  });

  test("ignores legacy per-script disableAllGrants when it is stored", () => {
    const state = coerceStoredToolState(
      {
        ...buildStoredState(),
        permissions: {
          allowedGrants: [],
          disableAllGrants: true,
        },
      },
      "Page Proxy",
    );

    expect(state?.permissions.allowedGrants).toEqual([]);
    expect(state?.permissions.enabled).toBe(true);
  });

  test("script run payloads round-trip runtime storage", () => {
    const request: ScriptRunRequest = {
      type: "script:run",
      requestId: "request-1",
      code: "pt.setItem('token', 'secret');",
      scriptName: "Page Proxy",
      runtimeStorage,
    };

    expect(isScriptRunRequest(request)).toBe(true);

    const response = buildScriptRunResponse("request-1", null, [], [], null, runtimeStorage);

    expect(isScriptRunResponse(response)).toBe(true);
    expect(response.runtimeStorage).toEqual(runtimeStorage);
  });

  test("stores pt values in the per-script runtime storage object", () => {
    const storage = createEmptyStoredRuntimeStorage();
    const adapter = createStoredRuntimeStorageAdapter(storage);
    const pt = createStorage(undefined, adapter);

    pt.setItem("token", "secret");

    expect(storage.pt).toEqual({
      "pp-storage:global:token": "secret",
    });
  });

  test("stores pn cache entries in the per-script runtime storage object", async () => {
    const storage = cloneStoredRuntimeStorage(createEmptyStoredRuntimeStorage());
    const adapter = createStoredRuntimeStorageAdapter(storage);
    const pn = createNetwork(undefined, adapter);
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('{"items":[1]}', {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await pn.fetch("https://api.example.com/items", { cache: true });
    const cachedResponse = await pn.fetch("https://api.example.com/items", { cache: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Object.keys(storage.pn)).toEqual(["pp-network-cache:global:https://api.example.com/items"]);
    expect(await cachedResponse.text()).toBe('{"items":[1]}');

    expect(pn.invalidateCache("https://api.example.com/items")).toBe(true);
    expect(storage.pn).toEqual({});
  });
});
