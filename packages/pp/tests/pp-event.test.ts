import { describe, expect, test } from "bun:test";
import { awaitAnimation, awaitMicrotask, sleep } from "../src/pp-event";

describe("pp-event async helpers", () => {
  test("sleep resolves asynchronously", async () => {
    let resolved = false;
    const promise = sleep(0).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    await promise;
    expect(resolved).toBe(true);
  });

  test("awaitAnimation uses requestAnimationFrame when available", async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    let callCount = 0;

    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callCount += 1;
      return setTimeout(() => callback(Date.now()), 0);
    };

    await awaitAnimation();

    expect(callCount).toBe(1);
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  });

  test("awaitMicrotask resolves in a microtask", async () => {
    const order: string[] = [];
    const promise = awaitMicrotask().then(() => {
      order.push("microtask");
    });

    order.push("sync");
    await promise;

    expect(order).toEqual(["sync", "microtask"]);
  });
});
