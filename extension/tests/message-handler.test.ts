import { describe, expect, test } from "bun:test";
import { saveSelectorDefinition, type MessageHandlerDeps } from "../src/entrypoints/sidepanel/message-handler";

const oldSelectorDefinition = `const overdueWrapper = pq.selector({
  "name": "main div wrapper with id",
  "baseSelector": "#overdue-submissions",
  "matches": e => true,
});`;

const updatedSelectorDefinition = `const overdueWrapper = pq.selector({
  "name": "updated selector",
  "baseSelector": "#due-soon-submissions",
  "matches": e => true,
});`;

const originalCssBlock = `#overdue-submissions {
  color: red;
}`;

const updatedCssSnippet = `ps.injectCSS(\`
#due-soon-submissions {
  color: blue;
}
\`);`;

const createDeps = (initialContent: string) => {
  let editorContent = initialContent;
  let latestError: string | null = null;
  const insertedDefinitions: string[][] = [];

  const deps: MessageHandlerDeps = {
    getSelectorEntries: () => [],
    getElementEntries: () => [],
    getEditorContent: () => editorContent,
    insertDefinitions: (lines) => {
      insertedDefinitions.push(lines);
      return true;
    },
    replaceEditorContent: (nextContent) => {
      editorContent = nextContent;
      return true;
    },
    setError: (message) => {
      latestError = message;
    },
  };

  return {
    deps,
    getEditorContent: () => editorContent,
    getInsertedDefinitions: () => insertedDefinitions,
    getLatestError: () => latestError,
  };
};

describe("saveSelectorDefinition", () => {
  test("replaces an edited pq.selector block in place", () => {
    const harness = createDeps(`${oldSelectorDefinition}\n\nconst somethingElse = 1;`);

    const result = saveSelectorDefinition(
      {
        name: null,
        code: updatedSelectorDefinition,
        originalCode: oldSelectorDefinition,
      },
      harness.deps,
    );

    expect(result).toEqual({ ok: true });
    expect(harness.getEditorContent()).toContain(updatedSelectorDefinition);
    expect(harness.getEditorContent()).not.toContain(oldSelectorDefinition);
    expect(harness.getInsertedDefinitions()).toHaveLength(0);
    expect(harness.getLatestError()).toBeNull();
  });

  test("allows keeping the same selector variable name while editing", () => {
    const harness = createDeps(oldSelectorDefinition);

    const result = saveSelectorDefinition(
      {
        name: null,
        code: updatedSelectorDefinition,
        originalCode: oldSelectorDefinition,
      },
      harness.deps,
    );

    expect(result).toEqual({ ok: true });
    expect(harness.getLatestError()).toBeNull();
  });

  test("replaces an edited CSS rule inside the existing ps.injectCSS call", () => {
    const existingContent = `ps.injectCSS(\`
#overdue-submissions {
  color: red;
}
header {
  border: none;
}
\`);`;
    const harness = createDeps(existingContent);

    const result = saveSelectorDefinition(
      {
        name: null,
        code: updatedCssSnippet,
        baseSelector: "#due-soon-submissions",
        originalCode: originalCssBlock,
      },
      harness.deps,
    );

    expect(result).toEqual({ ok: true });
    expect(harness.getEditorContent()).toContain("#due-soon-submissions {\n  color: blue;\n}");
    expect(harness.getEditorContent()).toContain("header {\n  border: none;\n}");
    expect(harness.getEditorContent().match(/ps\.injectCSS/g)).toHaveLength(1);
    expect(harness.getInsertedDefinitions()).toHaveLength(0);
    expect(harness.getLatestError()).toBeNull();
  });
});
