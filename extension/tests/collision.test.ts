import { describe, expect, test } from "bun:test";
import { resolveRecordConverterCollisions } from "../src/entrypoints/select-tool.content/record-converter/collision";

describe("resolveRecordConverterCollisions", () => {
  test("returns unchanged code when there are no collisions", () => {
    const result = resolveRecordConverterCollisions({
      code: "const foo = 1;",
      existingCode: "const bar = 2;",
    });
    expect(result.finalCode).toBe("const foo = 1;");
    expect(result.renameMap).toEqual({});
  });

  test("renames a declared identifier that collides with existing code", () => {
    const result = resolveRecordConverterCollisions({
      code: "const step = 1;",
      existingCode: "const step = 0;",
    });
    expect(result.renameMap).toEqual({ step: "step2" });
    expect(result.finalCode).toBe("const step2 = 1;");
  });

  test("skips renaming when the collision is only inside a string literal", () => {
    const result = resolveRecordConverterCollisions({
      code: "const step = 1;",
      existingCode: 'const message = "step done";',
    });
    // "step" in a string literal should NOT count as a collision
    expect(result.renameMap).toEqual({});
    expect(result.finalCode).toBe("const step = 1;");
  });

  test("returns empty renameMap and original code when code is empty", () => {
    const result = resolveRecordConverterCollisions({ code: "", existingCode: "const x = 1;" });
    expect(result.renameMap).toEqual({});
    expect(result.finalCode).toBe("");
  });

  test("renames a function declaration that collides", () => {
    const result = resolveRecordConverterCollisions({
      code: "async function step1() { return 1; }",
      existingCode: "function step1() {}",
    });
    expect(result.renameMap).toEqual({ step1: "step2" });
    expect(result.finalCode).toContain("async function step2()");
  });

  test("increments suffix past existing suffixed identifiers", () => {
    const result = resolveRecordConverterCollisions({
      code: "const step = 1;",
      existingCode: "const step = 0; const step2 = 3;",
    });
    expect(result.renameMap).toEqual({ step: "step3" });
  });
});
