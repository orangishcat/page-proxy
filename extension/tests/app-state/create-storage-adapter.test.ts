import { describe, expect, test } from "bun:test";
import { proxy } from "svelte/internal/client";
import { z } from "zod";
import { createStorageAdapter } from "../../src/lib/app-state/storage/create-storage-adapter";

describe("createStorageAdapter", () => {
  test("deproxies nested values before persisting", async () => {
    let storedItems: Record<string, unknown> | undefined;

    const adapter = createStorageAdapter({
      area: {
        get: () => Promise.resolve({}),
        set: (items) => {
          storedItems = structuredClone(items);
          return Promise.resolve();
        },
        remove: () => Promise.resolve(),
      },
      prefix: "pageproxy:",
      schema: z.record(z.string(), z.unknown()),
      loggerName: "test-storage-adapter",
    });

    const nextRecord = proxy({
      "Docs Script": {
        permissions: {
          allowedGrants: ["run-on-page-load"],
          enabled: true,
        },
      },
    }) as Record<string, unknown>;

    await adapter.persist(nextRecord);

    expect(storedItems).toEqual({
      "pageproxy:Docs Script": {
        permissions: {
          allowedGrants: ["run-on-page-load"],
          enabled: true,
        },
      },
    });
  });
});
