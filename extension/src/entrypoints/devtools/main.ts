import { browser } from "wxt/browser";
import log from "loglevel";

import {
  devtoolsSelectionPortName,
  type DevtoolsElementSelection,
  type DevtoolsSelectionCommandMessage,
  type DevtoolsSelectionCommandResultMessage,
  type DevtoolsSelectionUpdateMessage,
} from "@/lib/devtools-selection";

type EvalSelectionResult = {
  ok: boolean;
  selection: DevtoolsElementSelection | null;
  error?: string;
};

const logger = log.getLogger("devtools-bridge");
logger.setLevel("debug", false);

const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
const selectionPort = browser.runtime.connect({
  name: devtoolsSelectionPortName,
});

const selectionEvalSource = (selectParent: boolean) => `(() => {
  const hoverClass = "pp-hover";
  const selectedClass = "pp-selected";
  const hoveredPreviewClass = "pp-hovered";
  const filteredSelectionClasses = new Set([hoverClass, selectedClass, hoveredPreviewClass]);

  const filterSelectionClasses = (value) => {
    if (!value) {
      return null;
    }

    const tokens = value
      .split(/\\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && !filteredSelectionClasses.has(token));
    return tokens.length > 0 ? tokens.join(" ") : null;
  };

  const escapeSelector = (value) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }

    return value.replace(/[^a-zA-Z0-9_-]/g, (token) => \`\\\\\${token}\`);
  };

  const getElementSelector = (element) => {
    if (element.id) {
      return \`#\${escapeSelector(element.id)}\`;
    }

    const segments = [];
    let current = element;
    while (current && segments.length < 4) {
      let segment = current.tagName.toLowerCase();
      const classList = Array.from(current.classList)
        .filter((token) => token && !filteredSelectionClasses.has(token))
        .slice(0, 2);
      if (classList.length > 0) {
        segment += \`.\${classList.map(escapeSelector).join(".")}\`;
      }

      const parent = current.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(
          (child) => child instanceof Element && child.tagName === current.tagName,
        );
        if (sameTag.length > 1) {
          segment += \`:nth-of-type(\${sameTag.indexOf(current) + 1})\`;
        }
      }

      segments.unshift(segment);
      if (current.tagName.toLowerCase() === "body") {
        break;
      }

      current = current.parentElement;
    }

    return segments.join(" > ");
  };

  const getElementInfo = (element) => {
    const rect = element.getBoundingClientRect();
    const innerText = element instanceof HTMLElement ? element.innerText.trim() : "";
    const attributes = Object.fromEntries(
      Array.from(element.attributes)
        .map((attribute) => {
          if (attribute.name === "class") {
            const filteredClassName = filterSelectionClasses(attribute.value);
            return filteredClassName ? [attribute.name, filteredClassName] : null;
          }

          return [attribute.name, attribute.value];
        })
        .filter((entry) => entry !== null),
    );

    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      name: element.getAttribute("name") ?? element.getAttribute("aria-label") ?? null,
      className: filterSelectionClasses(element.getAttribute("class")),
      innerText: innerText.length > 0 && innerText.length < 500 ? innerText : null,
      selector: getElementSelector(element),
      attributes,
      boundingBox: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      },
    };
  };

  try {
    let target = $0 instanceof Element ? $0 : null;
    if (${selectParent ? "true" : "false"}) {
      target = target?.parentElement ?? null;
      if (target) {
        inspect(target);
      }
    }

    if (!target) {
      return {
        ok: true,
        selection: null,
      };
    }

    return {
      ok: true,
      selection: {
        info: getElementInfo(target),
        frameId: null,
        frameUrl: window.location.href,
        updatedAt: Date.now(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      selection: null,
      error: message,
    };
  }
})()`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const getMessageType = (message: unknown) => {
  if (!isRecord(message)) {
    return "unknown";
  }

  return typeof message.type === "string" ? message.type : "unknown";
};

const isEvalSelectionResult = (value: unknown): value is EvalSelectionResult =>
  isRecord(value) &&
  typeof value.ok === "boolean" &&
  "selection" in value &&
  (value.selection === null || isRecord(value.selection));

const isCommandMessage = (message: unknown): message is DevtoolsSelectionCommandMessage =>
  isRecord(message) &&
  message.type === "devtools:command" &&
  typeof message.requestId === "string" &&
  (message.action === "get-selected" || message.action === "select-parent");

const isExceptionInfo = (value: unknown): value is { isException?: boolean; value?: unknown } =>
  isRecord(value);

const evaluateSelection = (selectParent: boolean) =>
  new Promise<EvalSelectionResult>((resolve) => {
    chrome.devtools.inspectedWindow.eval(
      selectionEvalSource(selectParent),
      (result: unknown, exceptionInfo: unknown) => {
        if (isExceptionInfo(exceptionInfo) && exceptionInfo.isException) {
          const valueText = typeof exceptionInfo.value === "string" ? exceptionInfo.value : "Unable to evaluate $0.";
          resolve({
            ok: false,
            selection: null,
            error: valueText,
          });
          return;
        }

        if (!isEvalSelectionResult(result)) {
          resolve({
            ok: false,
            selection: null,
            error: "Unexpected DevTools evaluation result.",
          });
          return;
        }

        resolve(result);
      },
    );
  });

const postSelectionUpdate = (selection: DevtoolsElementSelection | null) => {
  const message: DevtoolsSelectionUpdateMessage = {
    type: "devtools:selection:update",
    tabId: inspectedTabId,
    selection,
  };

  logger.debug("port message sent", { type: message.type, tabId: inspectedTabId });
  selectionPort.postMessage(message);
};

const publishCurrentSelection = () => {
  void evaluateSelection(false).then((result) => {
    if (!result.ok) {
      logger.debug("Unable to publish current DevTools selection.", { error: result.error });
      postSelectionUpdate(null);
      return;
    }

    postSelectionUpdate(result.selection);
  });
};

selectionPort.onMessage.addListener((message: unknown) => {
  const messageType = getMessageType(message);
  logger.debug("port message received", { type: messageType });

  if (!isCommandMessage(message)) {
    return;
  }

  const selectParent = message.action === "select-parent";
  void evaluateSelection(selectParent).then((result) => {
    const response: DevtoolsSelectionCommandResultMessage = {
      type: "devtools:command:result",
      requestId: message.requestId,
      ok: result.ok,
      selection: result.selection,
      error: result.error,
    };
    logger.debug("port message sent", {
      type: response.type,
      requestId: response.requestId,
      ok: response.ok,
    });
    selectionPort.postMessage(response);

    if (result.ok) {
      postSelectionUpdate(result.selection);
    }
  });
});

chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
  publishCurrentSelection();
});

selectionPort.onDisconnect.addListener(() => {
  logger.debug("DevTools bridge disconnected.");
});

publishCurrentSelection();
