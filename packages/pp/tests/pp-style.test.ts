import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { injectCSS } from "../src/pp-style";

const flushMutations = () => new Promise((resolve) => window.setTimeout(resolve, 0));

describe("pp-style injectCSS", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  test("keeps css text unchanged when priority is normal", () => {
    expect(injectCSS(".target { color: red; }", { priority: "normal" })).toBe(true);

    const styleElement = document.head.querySelector("style");
    expect(styleElement?.textContent).toBe(".target { color: red; }");
  });

  test("defaults to high priority and rewrites injected css with !important declarations", () => {
    expect(injectCSS(".target { color: red; }")).toBe(true);

    const styleElement = document.head.querySelector("style");
    expect(styleElement?.textContent).toContain("color:red!important");
  });

  test("applies inline important styles to existing and future matches when priority is xhigh", async () => {
    const existing = document.createElement("div");
    existing.className = "target";
    document.body.appendChild(existing);

    expect(injectCSS(".target { color: red; }", { priority: "xhigh" })).toBe(true);
    expect(document.head.querySelectorAll("style")).toHaveLength(1);
    expect(existing.style.getPropertyValue("color")).toBe("red");
    expect(existing.style.getPropertyPriority("color")).toBe("important");

    const addedLater = document.createElement("div");
    addedLater.className = "target";
    document.body.appendChild(addedLater);
    await flushMutations();

    expect(addedLater.style.getPropertyValue("color")).toBe("red");
    expect(addedLater.style.getPropertyPriority("color")).toBe("important");
  });

  test("handles grouped selectors with commas inside functional pseudos when priority is xhigh", async () => {
    const primary = document.createElement("div");
    primary.className = "grouped-target grouped-first";
    document.body.appendChild(primary);

    const secondary = document.createElement("div");
    secondary.className = "grouped-other";
    document.body.appendChild(secondary);

    expect(
      injectCSS(".grouped-target:is(.grouped-first, .grouped-second), .grouped-other { color: green; }", {
        priority: "xhigh",
      }),
    ).toBe(true);
    await flushMutations();

    expect(primary.style.getPropertyValue("color")).toBe("green");
    expect(primary.style.getPropertyPriority("color")).toBe("important");
    expect(secondary.style.getPropertyValue("color")).toBe("green");
    expect(secondary.style.getPropertyPriority("color")).toBe("important");
  });

  test("handles selectors with backslashes and escaped colons when priority is xhigh", async () => {
    const primary = document.createElement("div");
    primary.className = "md:hover:bg-blue-500";
    document.body.appendChild(primary);

    const secondary = document.createElement("div");
    secondary.className = "lg:focus:bg-red-500";
    document.body.appendChild(secondary);

    expect(
      injectCSS(".md\\:hover\\:bg-blue-500, .lg\\:focus\\:bg-red-500 { color: purple; }", {
        priority: "xhigh",
      }),
    ).toBe(true);
    await flushMutations();

    expect(primary.style.getPropertyValue("color")).toBe("purple");
    expect(primary.style.getPropertyPriority("color")).toBe("important");
    expect(secondary.style.getPropertyValue("color")).toBe("purple");
    expect(secondary.style.getPropertyPriority("color")).toBe("important");
  });

  test("upgrades an existing injected stylesheet to xhigh without duplicating the style tag", async () => {
    const target = document.createElement("div");
    target.className = "target-upgrade";
    document.body.appendChild(target);

    expect(injectCSS(".target-upgrade { color: blue; }")).toBe(true);
    expect(injectCSS(".target-upgrade { color: blue; }", { priority: "xhigh" })).toBe(true);
    await flushMutations();

    expect(document.head.querySelectorAll("style")).toHaveLength(1);
    expect(target.style.getPropertyValue("color")).toBe("blue");
    expect(target.style.getPropertyPriority("color")).toBe("important");
    expect(injectCSS(".target-upgrade { color: blue; }", { priority: "xhigh" })).toBe(false);
  });
});
