import { describe, expect, test } from "bun:test";
import { AppStatePersistHandler, type AppStatePersistEntry } from "../../src/lib/app-state/storage/persist/persist-handler";

describe("AppStatePersistHandler", () => {
  test("uses deep equality for registry values", async () => {
    const writes: unknown[] = [];
    let current = { a: 1, b: 2 };

    const registry: AppStatePersistEntry[] = [
      {
        name: "sample",
        read: () => current,
        persist: (next) => {
          writes.push(next);
        },
      },
    ];

    const handler = new AppStatePersistHandler(registry);

    await handler.checkPersist();
    current = { b: 2, a: 1 };
    await handler.checkPersist();
    current = { a: 1, b: 3 };
    await handler.checkPersist();

    expect(writes).toEqual([{ a: 1, b: 3 }]);
  });
});
