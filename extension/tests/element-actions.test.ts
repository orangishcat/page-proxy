import { describe, expect, test } from "bun:test";

import { runSelectElementAction } from "../src/entrypoints/select-tool.content/selection/element-actions";

describe("runSelectElementAction", () => {
  test("hide applies display none without clearing the selected element", () => {
    const target = {
      isConnected: true,
      style: {
        display: "",
      },
    } as unknown as HTMLElement;
    let clearCalls = 0;

    const result = runSelectElementAction("hide", target, () => {
      clearCalls += 1;
    });

    expect(result).toEqual({ ok: true });
    expect(target.style.display).toBe("none");
    expect(clearCalls).toBe(0);
  });
});
