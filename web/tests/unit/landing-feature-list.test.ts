import { describe, expect, test } from "bun:test";

const featureListPath = new URL("../../src/lib/components/landing/LandingFeatureList.svelte", import.meta.url);
const cursorDemoPath = new URL("../../src/lib/components/landing/LandingFeatureCursorDemo.svelte", import.meta.url);
const editorPreviewPath = new URL("../../src/lib/components/landing/LandingFeatureEditorPreview.svelte", import.meta.url);
const moduleTreePath = new URL("../../src/lib/components/landing/LandingFeatureModuleTree.svelte", import.meta.url);
const pagePath = new URL("../../src/routes/+page.svelte", import.meta.url);

describe("LandingFeatureList", () => {
  test("includes the feature headings and Monaco link", async () => {
    const markup = await Bun.file(featureListPath).text();

    expect(markup).toContain("More designing, less tinkering.");
    expect(markup).toContain("Powerful scripting API.");
    expect(markup).toContain("Editor included.");
    expect(markup).toContain("https://microsoft.github.io/monaco-editor/");
  });

  test("uses the empty code editor screenshot in the third panel", async () => {
    const markup = await Bun.file(editorPreviewPath).text();

    expect(markup).toContain('/assets/code_editor_empty.avif');
  });

  test("is wired into the landing page below the hero demo", async () => {
    const pageMarkup = await Bun.file(pagePath).text();

    expect(pageMarkup).toContain('import LandingFeatureList from "$lib/components/landing/LandingFeatureList.svelte";');
    expect(pageMarkup).toContain("<LandingFeatureList />");
  });

  test("does not include eyebrow labels", async () => {
    const markup = await Bun.file(featureListPath).text();

    expect(markup).not.toContain("Visual tools");
    expect(markup).not.toContain("Ship real behavior");
    expect(markup).not.toContain("Stay in flow");
  });

  test("keeps the feature components on canonical tailwind rounding classes", async () => {
    const sources = await Promise.all([
      Bun.file(featureListPath).text(),
      Bun.file(cursorDemoPath).text(),
      Bun.file(moduleTreePath).text(),
      Bun.file(editorPreviewPath).text(),
    ]);

    for (const source of sources) {
      expect(source).not.toContain("rounded-[");
    }
  });

  test("uses gsap for the cursor demo and removes the tree accent stroke", async () => {
    const [cursorDemoMarkup, moduleTreeMarkup] = await Promise.all([
      Bun.file(cursorDemoPath).text(),
      Bun.file(moduleTreePath).text(),
    ]);

    expect(cursorDemoMarkup).toContain('await import("gsap")');
    expect(cursorDemoMarkup).not.toContain("@keyframes");
    expect(moduleTreeMarkup).not.toContain("url(#module-accent)");
  });
});
