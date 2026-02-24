import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createApi, moveNode, notification, notificationSinkGlobalKey, pp, renderMarkdown } from "../src/pp-api";

const notificationHostId = "__pageProxyNotificationHost";

describe("pp-api", () => {
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete (globalThis as Record<string, unknown>)[notificationSinkGlobalKey];
    originalConsoleLog = console.log;
    console.log = () => {};
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    delete (globalThis as Record<string, unknown>)[notificationSinkGlobalKey];
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  test("renderMarkdown sanitizes and applies default link attributes", () => {
    const html = renderMarkdown("hello [docs](https://example.com) <script>alert('x')</script>");

    const template = document.createElement("template");
    template.innerHTML = html;

    const link = template.content.querySelector("a[href]");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noreferrer noopener");
    expect(link?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(template.content.querySelector("script")).toBeNull();
  });

  test("renderMarkdown applies custom link options", () => {
    const html = renderMarkdown("[docs](https://example.com)", {
      linkTarget: "_self",
      linkRel: "nofollow",
      linkReferrerPolicy: "origin",
      breaks: false,
    });

    const template = document.createElement("template");
    template.innerHTML = html;

    const link = template.content.querySelector("a[href]");
    expect(link?.getAttribute("target")).toBe("_self");
    expect(link?.getAttribute("rel")).toBe("nofollow");
    expect(link?.getAttribute("referrerpolicy")).toBe("origin");
  });

  test("moveNode moves elements to a requested position", () => {
    const parent = document.createElement("div");
    const first = document.createElement("span");
    first.id = "first";
    const second = document.createElement("span");
    second.id = "second";
    const third = document.createElement("span");
    third.id = "third";

    parent.append(first, second, third);
    moveNode(third, 0, parent);

    expect(Array.from(parent.children).map((node) => node.id)).toEqual(["third", "first", "second"]);
  });

  test("moveNode supports negative positions and clamping", () => {
    const parent = document.createElement("div");
    const first = document.createElement("span");
    first.id = "first";
    const second = document.createElement("span");
    second.id = "second";
    const third = document.createElement("span");
    third.id = "third";

    parent.append(first, second, third);
    moveNode(first, -1, parent);
    expect(Array.from(parent.children).map((node) => node.id)).toEqual(["second", "third", "first"]);

    moveNode(second, 999, parent);
    expect(Array.from(parent.children).map((node) => node.id)).toEqual(["third", "first", "second"]);
  });

  test("moveNode returns the same node when parent is null", () => {
    const orphan = document.createElement("div");
    expect(moveNode(orphan, 0, null)).toBe(orphan);
  });

  test("notification logs, notifies sink, and renders page notifications", () => {
    const sinkPayloads: Array<{ level: string; values: unknown[] }> = [];
    (globalThis as Record<string, unknown>)[notificationSinkGlobalKey] = (payload: {
      level: string;
      values: unknown[];
    }) => {
      sinkPayloads.push(payload);
    };

    notification("Saved", { ok: true });

    const host = document.getElementById(notificationHostId);
    expect(host).not.toBeNull();
    expect(host?.children.length).toBe(1);
    expect(sinkPayloads).toEqual([{ level: "notification", values: ["Saved", { ok: true }] }]);
  });

  test("notification host keeps at most four notifications", () => {
    for (let index = 0; index < 5; index += 1) {
      notification(`message-${index}`);
    }

    const host = document.getElementById(notificationHostId);
    expect(host).not.toBeNull();
    expect(host?.children.length).toBe(4);
  });

  test("createApi returns the public API shape", () => {
    const api = createApi();
    expect(Object.keys(api).sort()).toEqual(["moveNode", "notification", "renderMarkdown"]);
    expect(api.moveNode).toBe(moveNode);
    expect(api.notification).toBe(notification);
    expect(api.renderMarkdown).toBe(renderMarkdown);
  });

  test("pp exposes the default API instance", () => {
    expect(pp.moveNode).toBe(moveNode);
    expect(pp.notification).toBe(notification);
    expect(pp.renderMarkdown).toBe(renderMarkdown);
  });
});
