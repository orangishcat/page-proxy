import { describe, expect, test } from "bun:test";
import {
  coerceScriptGrantValues,
  getGrantDocumentationUrl,
  parseScriptGrantValues,
  resolveEffectiveScriptGrants,
  supportedScriptGrants,
} from "../src/lib/grants";

describe("grants", () => {
  test("parseScriptGrantValues parses and deduplicates tokens", () => {
    const parsed = parseScriptGrantValues("run-on-page-load, run-on-page-load");
    expect(parsed).toEqual(["run-on-page-load"]);
  });

  test("parseScriptGrantValues rejects unsupported grants", () => {
    expect(() => parseScriptGrantValues("unknown-grant")).toThrow(
      'Unsupported @grant value "unknown-grant". Supported values: run-on-page-load.',
    );
  });

  test("coerceScriptGrantValues keeps only supported values", () => {
    const coerced = coerceScriptGrantValues(["run-on-page-load", "RUN-ON-PAGE-LOAD", "other", 42]);
    expect(coerced).toEqual(["run-on-page-load"]);
  });

  test("coerceScriptGrantValues returns empty list for non-array", () => {
    expect(coerceScriptGrantValues("run-on-page-load")).toEqual([]);
  });

  test("getGrantDocumentationUrl returns a fragment URL", () => {
    expect(getGrantDocumentationUrl(supportedScriptGrants[0])).toBe(
      "https://orangishcat.github.io/page-proxy/docs/permissions#grant-run-on-page-load",
    );
  });

  test("resolveEffectiveScriptGrants keeps declared grants when the global toggle is off", () => {
    expect(resolveEffectiveScriptGrants(["run-on-page-load"], false, true)).toEqual(["run-on-page-load"]);
  });

  test("resolveEffectiveScriptGrants removes all declared grants when the global toggle is on", () => {
    expect(resolveEffectiveScriptGrants(["run-on-page-load"], true, true)).toEqual([]);
  });

  test("resolveEffectiveScriptGrants removes all declared grants when the script is disabled", () => {
    expect(resolveEffectiveScriptGrants(["run-on-page-load"], false, false)).toEqual([]);
  });
});
