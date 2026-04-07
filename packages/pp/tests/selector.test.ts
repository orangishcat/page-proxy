import { describe, expect, test } from "bun:test";

import { selector } from "../src/pp-query/selector";

describe("selector", () => {
  test("defaults name and matches when they are omitted", () => {
    document.body.innerHTML = `
      <main>
        <button class="save">Save</button>
        <button class="cancel">Cancel</button>
      </main>
    `;

    const saveButtons = selector({
      baseSelector: "button.save",
    });

    expect(saveButtons.query()).toBe(document.querySelector("button.save"));
    expect(saveButtons.queryAll()).toEqual([document.querySelector("button.save")]);
    expect(saveButtons.matches(document.querySelector("button.save") as Element)).toBe(true);
  });
});
