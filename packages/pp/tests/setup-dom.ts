import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
const { window } = dom;

(globalThis as unknown as Record<string, unknown>).window = window;
(globalThis as unknown as Record<string, unknown>).document = window.document;
(globalThis as unknown as Record<string, unknown>).Element = window.Element;
(globalThis as unknown as Record<string, unknown>).Node = window.Node;
(globalThis as unknown as Record<string, unknown>).HTMLElement = window.HTMLElement;
(globalThis as unknown as Record<string, unknown>).HTMLDivElement = window.HTMLDivElement;
(globalThis as unknown as Record<string, unknown>).HTMLTemplateElement = window.HTMLTemplateElement;
(globalThis as unknown as Record<string, unknown>).requestAnimationFrame =
  globalThis.requestAnimationFrame ??
  ((callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16));
(globalThis as unknown as Record<string, unknown>).cancelAnimationFrame =
  globalThis.cancelAnimationFrame ?? ((id: number) => window.clearTimeout(id));
(globalThis as unknown as Record<string, unknown>).atob = globalThis.atob ?? window.atob.bind(window);
(globalThis as unknown as Record<string, unknown>).btoa = globalThis.btoa ?? window.btoa.bind(window);
