import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

import type { ElementInfo, SelectorRuleFilters, SelectorSavePayload, SelectToolMessage } from "@/lib/selection";
import type { SidepanelShortcutId, SidepanelShortcutMessage } from "@/lib/sidepanel-shortcuts";

const hoverClass = "pp-hover";
const selectedClass = "pp-selected";
const styleId = "page-proxy-selection-styles";
const selectorLabelId = "page-proxy-selector-label";
const selectorPopupId = "page-proxy-selector-popup";
const selectionStyles = `
.pp-hover {
  outline: 0.125rem solid #86d24b !important;
  outline-offset: -0.0625rem !important;
}
.pp-selected {
  outline: 0.125rem solid #bb9348 !important;
  outline-offset: -0.0625rem !important;
}
.pp-selected-label {
  position: fixed;
  z-index: 2147483647;
  pointer-events: none;
  max-width: 24rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: #86d24b;
  color: #1b2614;
  font: 600 0.75rem/1.2 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.25);
}
.pp-selector-popup {
  position: fixed;
  z-index: 2147483647;
  width: min(32rem, 92vw);
  max-height: min(26rem, 80vh);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 0.0625rem solid #3d3a2f;
  background: #1c1b16;
  color: #f2f0ea;
  box-shadow: 0 0.75rem 1.5rem rgba(0, 0, 0, 0.35);
  font: 500 0.8125rem/1.4 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  pointer-events: auto;
}
.pp-selector-popup__arrow {
  position: absolute;
  width: var(--pp-arrow-size, 0.75rem);
  height: var(--pp-arrow-size, 0.75rem);
  background: inherit;
  border: 0.0625rem solid #3d3a2f;
  transform: rotate(45deg);
}
.pp-selector-popup--top .pp-selector-popup__arrow {
  bottom: calc(var(--pp-arrow-size, 0.75rem) * -0.5);
  left: var(--pp-arrow-left, 50%);
}
.pp-selector-popup--bottom .pp-selector-popup__arrow {
  top: calc(var(--pp-arrow-size, 0.75rem) * -0.5);
  left: var(--pp-arrow-left, 50%);
}
.pp-selector-popup--left .pp-selector-popup__arrow {
  right: calc(var(--pp-arrow-size, 0.75rem) * -0.5);
  top: var(--pp-arrow-top, 50%);
}
.pp-selector-popup--right .pp-selector-popup__arrow {
  left: calc(var(--pp-arrow-size, 0.75rem) * -0.5);
  top: var(--pp-arrow-top, 50%);
}
.pp-selector-popup--center .pp-selector-popup__arrow {
  display: none;
}
.pp-selector-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pp-selector-popup__title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.pp-selector-popup__close {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.25rem;
  border-radius: 0.5rem;
  cursor: pointer;
}
.pp-selector-popup__close:hover {
  background: rgba(255, 255, 255, 0.08);
}
.pp-selector-popup__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  min-height: 0;
}
.pp-selector-popup__panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
  padding: 0.5rem;
  border-radius: 0.625rem;
  border: 0.0625rem solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}
.pp-selector-popup__panel-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.7);
}
.pp-selector-popup__input {
  border-radius: 0.5rem;
  border: 0.0625rem solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.35);
  color: inherit;
  padding: 0.4rem 0.6rem;
  font: inherit;
}
.pp-selector-popup__rules {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
}
.pp-selector-popup__rule {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.pp-selector-popup__rule-title {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}
.pp-selector-popup__dropzone {
  min-height: 3rem;
  border-radius: 0.5rem;
  border: 0.0625rem dashed rgba(255, 255, 255, 0.2);
  padding: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.pp-selector-popup__dropzone.is-active {
  border-color: #86d24b;
  box-shadow: 0 0 0 0.0625rem rgba(134, 210, 75, 0.4);
}
.pp-selector-popup__rule-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.45rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
}
.pp-selector-popup__rule-item button {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  cursor: pointer;
}
.pp-selector-popup__rule-empty,
.pp-selector-popup__property-empty {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
}
.pp-selector-popup__properties {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.pp-selector-popup__property {
  border-radius: 0.5rem;
  border: 0.0625rem solid rgba(255, 255, 255, 0.12);
  padding: 0.4rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: rgba(0, 0, 0, 0.35);
  cursor: grab;
}
.pp-selector-popup__property:active {
  cursor: grabbing;
}
.pp-selector-popup__property-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.6);
}
.pp-selector-popup__property-value {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-word;
}
.pp-selector-popup__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}
.pp-selector-popup__button {
  flex: 1;
  border-radius: 0.6rem;
  border: 0;
  padding: 0.45rem 0.6rem;
  font: inherit;
  background: #86d24b;
  color: #1b2614;
  cursor: pointer;
}
.pp-selector-popup__button--ghost {
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
}
.pp-selector-popup__error {
  font-size: 0.75rem;
  color: #f4b4b4;
  min-height: 1rem;
}
@media (prefers-color-scheme: light) {
  .pp-selector-popup {
    background: #f7f4ee;
    color: #1f1d18;
    border-color: #d9d2c2;
  }
  .pp-selector-popup__arrow {
    border-color: #d9d2c2;
  }
  .pp-selector-popup__close:hover {
    background: rgba(0, 0, 0, 0.08);
  }
  .pp-selector-popup__panel {
    border-color: rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.04);
  }
  .pp-selector-popup__panel-title {
    color: rgba(0, 0, 0, 0.6);
  }
  .pp-selector-popup__input {
    border-color: rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.8);
  }
  .pp-selector-popup__rule-title {
    color: rgba(0, 0, 0, 0.6);
  }
  .pp-selector-popup__dropzone {
    border-color: rgba(0, 0, 0, 0.2);
  }
  .pp-selector-popup__rule-item {
    background: rgba(0, 0, 0, 0.08);
  }
  .pp-selector-popup__rule-empty,
  .pp-selector-popup__property-empty {
    color: rgba(0, 0, 0, 0.5);
  }
  .pp-selector-popup__property {
    border-color: rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.85);
  }
  .pp-selector-popup__property-label {
    color: rgba(0, 0, 0, 0.5);
  }
  .pp-selector-popup__property-value {
    color: rgba(0, 0, 0, 0.85);
  }
  .pp-selector-popup__button {
    background: #4b7f1c;
    color: #f2f0ea;
  }
  .pp-selector-popup__button--ghost {
    background: rgba(0, 0, 0, 0.08);
    color: inherit;
  }
  .pp-selector-popup__error {
    color: #9c2f2f;
  }
}
`;
const filteredSelectionClasses = new Set([hoverClass, selectedClass]);

const filterSelectionClasses = (value: string | null) => {
  if (!value) {
    return null;
  }

  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !filteredSelectionClasses.has(token));

  return tokens.length > 0 ? tokens.join(" ") : null;
};

const escapeSelector = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, (match) => `\\${match}`);
};

const getElementSelector = (element: Element) => {
  if (element.id) {
    return `#${escapeSelector(element.id)}`;
  }

  const segments: string[] = [];
  let current: Element | null = element;

  while (current && segments.length < 4) {
    let segment = current.tagName.toLowerCase();
    const classList = Array.from(current.classList)
      .filter((token) => token && !filteredSelectionClasses.has(token))
      .slice(0, 2);

    if (classList.length > 0) {
      segment += `.${classList.map(escapeSelector).join(".")}`;
    }

    const parent = current.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (child) => child instanceof Element && child.tagName === current?.tagName,
      );

      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
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

const getElementInfo = (element: Element): ElementInfo => {
  const rect = element.getBoundingClientRect();
  const innerText = element instanceof HTMLElement ? element.innerText.trim() : "";
  const attributes = Object.fromEntries(
    Array.from(element.attributes)
      .map((attr) => {
        if (attr.name === "class") {
          const filtered = filterSelectionClasses(attr.value);
          return filtered ? ([attr.name, filtered] as const) : null;
        }

        return [attr.name, attr.value] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
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

type PropertyItem = {
  key: string;
  label: string;
  value: string;
  rawValue: string | ElementInfo["boundingBox"];
  primary: boolean;
};

const formatBoundingBoxCompact = (box: ElementInfo["boundingBox"]) =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

const getPrimaryPropertyItems = (info: ElementInfo): PropertyItem[] => {
  const items: PropertyItem[] = [];
  if (info.tag) {
    items.push({
      key: "tag",
      label: "Tag",
      value: info.tag,
      rawValue: info.tag,
      primary: true,
    });
  }

  if (info.id) {
    items.push({
      key: "id",
      label: "ID",
      value: info.id,
      rawValue: info.id,
      primary: true,
    });
  }

  if (info.className) {
    items.push({
      key: "class",
      label: "Class",
      value: info.className,
      rawValue: info.className,
      primary: true,
    });
  }

  if (info.name) {
    items.push({
      key: "name",
      label: "Name",
      value: info.name,
      rawValue: info.name,
      primary: true,
    });
  }

  items.push({
    key: "selector",
    label: "Selector",
    value: info.selector,
    rawValue: info.selector,
    primary: true,
  });

  items.push({
    key: "bbox",
    label: "BBox",
    value: formatBoundingBoxCompact(info.boundingBox),
    rawValue: info.boundingBox,
    primary: true,
  });

  if (info.innerText) {
    items.push({
      key: "innerText",
      label: "Inner text",
      value: info.innerText,
      rawValue: info.innerText,
      primary: false,
    });
  }

  return items;
};

const buildPropertyList = (info: ElementInfo | null): PropertyItem[] => {
  if (!info) {
    return [];
  }

  const properties = getPrimaryPropertyItems(info);
  const reservedKeys = new Set(["id", "class", "name", "tag", "selector"]);

  Object.entries(info.attributes)
    .filter(([key, value]) => !reservedKeys.has(key) && value.length > 0)
    .forEach(([key, value]) => {
      properties.push({
        key,
        label: key,
        value,
        rawValue: value,
        primary: false,
      });
    });

  return properties;
};

const ruleKeys = ["contains", "matches", "keyOnly"] as const;
type RuleKey = (typeof ruleKeys)[number];

type SelectorPopupState = {
  container: HTMLDivElement;
  arrow: HTMLDivElement;
  nameInput: HTMLInputElement;
  errorMessage: HTMLDivElement;
  rules: SelectorRuleFilters;
  propertyItems: PropertyItem[];
  propertyMap: Map<string, PropertyItem>;
  dropzones: Record<RuleKey, HTMLDivElement>;
  propertiesContainer: HTMLDivElement;
  saveButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  info: ElementInfo;
};

const createEmptyRules = (): SelectorRuleFilters => ({
  contains: {},
  matches: {},
  keyOnly: [],
});

const truncate = (value: string, maxLength = 120) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

const describeElement = (element: Element) => {
  const info = getElementInfo(element);
  return `${info.tag}${info.id ? `#${info.id}` : ""}${info.className ? `.${info.className.replace(" ", ".")}` : ""}`;
};

const getEventTarget = (event: Event): Element | null => {
  const path = event.composedPath();
  for (const target of path) {
    if (target instanceof Element) {
      return target;
    }
  }

  if (event.target instanceof Element) {
    return event.target;
  }

  return null;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable=\"true\"], [contenteditable=\"\"]'));
};

const getShortcutTool = (event: KeyboardEvent): SidepanelShortcutId | null => {
  if (!event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }

  switch (event.code) {
    case "Digit1":
      return "select";
    case "Digit2":
      return "new-element";
    case "Digit3":
      return "selectors";
    case "Digit4":
      return "help";
    case "Digit5":
      return "share";
    default:
      return null;
  }
};

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let selectionEnabled = false;
    let hoverTarget: Element | null = null;
    let selectedTarget: Element | null = null;
    let hoverFrame: number | null = null;
    let queuedHoverTarget: Element | null = null;
    let labelFrame: number | null = null;
    let queuedLabelTarget: Element | null = null;
    let selectorPopupState: SelectorPopupState | null = null;
    let popupTarget: Element | null = null;
    let popupFrame: number | null = null;

    const ensureSelectionStyles = () => {
      if (document.getElementById(styleId)) {
        return;
      }

      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = selectionStyles;
      const container = document.head ?? document.documentElement;
      container.appendChild(style);
    };

    const ensureSelectorLabel = () => {
      const existing = document.getElementById(selectorLabelId);
      if (existing) {
        return existing as HTMLDivElement;
      }

      const label = document.createElement("div");
      label.id = selectorLabelId;
      label.className = "pp-selected-label";
      label.dataset.pageProxy = "selector-label";
      document.body.appendChild(label);
      return label;
    };

    const removeSelectorLabel = () => {
      document.getElementById(selectorLabelId)?.remove();
    };

    const clearHover = () => {
      if (!hoverTarget) {
        return;
      }

      hoverTarget.classList.remove(hoverClass);
      hoverTarget = null;
      queuedLabelTarget = null;
      removeSelectorLabel();
    };

    const clearSelected = () => {
      if (!selectedTarget) {
        return;
      }

      selectedTarget.classList.remove(selectedClass);
      selectedTarget = null;
    };

    const isPopupTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return false;
      }

      return Boolean(target.closest(`#${selectorPopupId}`));
    };

    const setPopupError = (message: string) => {
      if (!selectorPopupState) {
        return;
      }

      selectorPopupState.errorMessage.textContent = message;
    };

    const renderRules = (state: SelectorPopupState) => {
      ruleKeys.forEach((ruleKey) => {
        const dropzone = state.dropzones[ruleKey];
        dropzone.replaceChildren();

        const items =
          ruleKey === "keyOnly"
            ? state.rules.keyOnly.map((key) => ({ key, value: "" }))
            : Object.entries(state.rules[ruleKey]).map(([key, value]) => ({ key, value }));

        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "pp-selector-popup__rule-empty";
          empty.textContent = "Drop properties here";
          dropzone.appendChild(empty);
          return;
        }

        items.forEach(({ key, value }) => {
          const item = document.createElement("div");
          item.className = "pp-selector-popup__rule-item";
          item.textContent = ruleKey === "keyOnly" ? key : `${key}: ${value}`;

          const removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.textContent = "x";
          removeButton.setAttribute("aria-label", `Remove ${key}`);
          removeButton.addEventListener("click", () => {
            if (ruleKey === "keyOnly") {
              state.rules.keyOnly = state.rules.keyOnly.filter((entry) => entry !== key);
            } else {
              const {[key]: _, ...rest} = state.rules[ruleKey];
              state.rules[ruleKey] = rest;
            }
            renderRules(state);
          });

          item.appendChild(removeButton);
          dropzone.appendChild(item);
        });
      });
    };

    const renderProperties = (state: SelectorPopupState) => {
      state.propertiesContainer.replaceChildren();

      if (state.propertyItems.length === 0) {
        const empty = document.createElement("div");
        empty.className = "pp-selector-popup__property-empty";
        empty.textContent = "No properties available.";
        state.propertiesContainer.appendChild(empty);
        return;
      }

      state.propertyItems.forEach((item) => {
        const property = document.createElement("div");
        property.className = "pp-selector-popup__property";
        property.draggable = true;
        property.dataset.key = item.key;
        property.dataset.value = item.value;

        property.addEventListener("dragstart", (event) => {
          const transfer = event.dataTransfer;
          if (!transfer) {
            return;
          }

          const separator = "\u0001";
          transfer.setData("text/plain", `${item.key}${separator}${item.value}`);
          transfer.effectAllowed = "copy";
        });

        const label = document.createElement("div");
        label.className = "pp-selector-popup__property-label";
        label.textContent = item.label;

        const value = document.createElement("div");
        value.className = "pp-selector-popup__property-value";
        value.textContent = item.value;

        property.append(label, value);
        state.propertiesContainer.appendChild(property);
      });
    };

    const submitSelectorPopup = (state: SelectorPopupState) => {
      if (!popupTarget || !popupTarget.isConnected) {
        setPopupError("Select an element before saving.");
        return;
      }

      const hasRules =
        Object.keys(state.rules.contains).length > 0 ||
        Object.keys(state.rules.matches).length > 0 ||
        state.rules.keyOnly.length > 0;

      if (!hasRules) {
        setPopupError("Add at least one rule to save a selector.");
        return;
      }

      const info = state.info;
      const bboxItem = state.propertyMap.get("bbox");
      const includesBBox =
        "bbox" in state.rules.contains ||
        "bbox" in state.rules.matches ||
        state.rules.keyOnly.includes("bbox");

      const payload: SelectorSavePayload = {
        name: state.nameInput.value.trim() || null,
        selector: info.selector,
        bbox:
          includesBBox && bboxItem && typeof bboxItem.rawValue !== "string"
            ? bboxItem.rawValue
            : undefined,
        properties: state.rules,
      };

      void browser.runtime
        .sendMessage({
          type: "selector:save",
          payload,
        } satisfies SelectToolMessage)
        .then(() => {
          clearSelectorPopup();
        })
        .catch(() => {
          setPopupError("Unable to save selector.");
        });
    };

    const createSelectorPopup = (info: ElementInfo): SelectorPopupState | null => {
      const propertyItems = buildPropertyList(info);
      const propertyMap = new Map(propertyItems.map((item) => [item.key, item]));
      const container = document.createElement("div");
      container.id = selectorPopupId;
      container.className = "pp-selector-popup pp-selector-popup--right";
      container.style.left = "0rem";
      container.style.top = "0rem";
      container.style.visibility = "hidden";
      container.innerHTML = `
        <div class="pp-selector-popup__arrow" data-arrow></div>
        <div class="pp-selector-popup__header">
          <span class="pp-selector-popup__title">Save selector</span>
          <button class="pp-selector-popup__close" type="button" data-close aria-label="Close popup">x</button>
        </div>
        <div class="pp-selector-popup__body">
          <div class="pp-selector-popup__panel">
            <div class="pp-selector-popup__panel-title">Selector rules</div>
            <input class="pp-selector-popup__input" data-name placeholder="Selector name" />
            <div class="pp-selector-popup__rules">
              <div class="pp-selector-popup__rule">
                <div class="pp-selector-popup__rule-title">Contains</div>
                <div class="pp-selector-popup__dropzone" data-rule="contains"></div>
              </div>
              <div class="pp-selector-popup__rule">
                <div class="pp-selector-popup__rule-title">Matches</div>
                <div class="pp-selector-popup__dropzone" data-rule="matches"></div>
              </div>
              <div class="pp-selector-popup__rule">
                <div class="pp-selector-popup__rule-title">Key only</div>
                <div class="pp-selector-popup__dropzone" data-rule="keyOnly"></div>
              </div>
            </div>
            <div class="pp-selector-popup__error" data-error></div>
            <div class="pp-selector-popup__actions">
              <button class="pp-selector-popup__button" type="button" data-save>Save selector</button>
              <button class="pp-selector-popup__button pp-selector-popup__button--ghost" type="button" data-cancel>Cancel</button>
            </div>
          </div>
          <div class="pp-selector-popup__panel">
            <div class="pp-selector-popup__panel-title">Properties</div>
            <div class="pp-selector-popup__properties" data-properties></div>
          </div>
        </div>
      `;

      const arrow = container.querySelector<HTMLDivElement>("[data-arrow]");
      const nameInput = container.querySelector<HTMLInputElement>("[data-name]");
      const errorMessage = container.querySelector<HTMLDivElement>("[data-error]");
      const propertiesContainer = container.querySelector<HTMLDivElement>("[data-properties]");
      const saveButton = container.querySelector<HTMLButtonElement>("[data-save]");
      const cancelButton = container.querySelector<HTMLButtonElement>("[data-cancel]");
      const closeButton = container.querySelector<HTMLButtonElement>("[data-close]");

      if (
        !arrow ||
        !nameInput ||
        !errorMessage ||
        !propertiesContainer ||
        !saveButton ||
        !cancelButton ||
        !closeButton
      ) {
        container.remove();
        return null;
      }

      const dropzones = {
        contains: container.querySelector<HTMLDivElement>('[data-rule="contains"]'),
        matches: container.querySelector<HTMLDivElement>('[data-rule="matches"]'),
        keyOnly: container.querySelector<HTMLDivElement>('[data-rule="keyOnly"]'),
      };

      if (!dropzones.contains || !dropzones.matches || !dropzones.keyOnly) {
        container.remove();
        return null;
      }

      const resolvedDropzones: Record<RuleKey, HTMLDivElement> = {
        contains: dropzones.contains,
        matches: dropzones.matches,
        keyOnly: dropzones.keyOnly,
      };

      const state: SelectorPopupState = {
        container,
        arrow,
        nameInput,
        errorMessage,
        rules: createEmptyRules(),
        propertyItems,
        propertyMap,
        dropzones: resolvedDropzones,
        propertiesContainer,
        saveButton,
        cancelButton,
        closeButton,
        info,
      };

      closeButton.addEventListener("click", () => clearSelectorPopup());
      cancelButton.addEventListener("click", () => clearSelectorPopup());
      saveButton.addEventListener("click", () => submitSelectorPopup(state));

      ruleKeys.forEach((ruleKey) => {
        const dropzone = state.dropzones[ruleKey];
        dropzone.addEventListener("dragover", (event) => {
          event.preventDefault();
          dropzone.classList.add("is-active");
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "copy";
          }
        });
        dropzone.addEventListener("dragleave", () => {
          dropzone.classList.remove("is-active");
        });
        dropzone.addEventListener("drop", (event) => {
          event.preventDefault();
          dropzone.classList.remove("is-active");
          const transfer = event.dataTransfer;
          if (!transfer) {
            return;
          }

          const separator = "\u0001";
          const data = transfer.getData("text/plain");
          if (!data) {
            return;
          }

          const [key, value = ""] = data.split(separator);
          if (!key) {
            return;
          }

          if (ruleKey === "keyOnly") {
            if (!state.rules.keyOnly.includes(key)) {
              state.rules.keyOnly = [...state.rules.keyOnly, key];
            }
          } else {
            const property = state.propertyMap.get(key);
            const nextValue = value || property?.value || "";
            if (nextValue.length === 0) {
              return;
            }
            state.rules[ruleKey] = {
              ...state.rules[ruleKey],
              [key]: nextValue,
            };
          }

          setPopupError("");
          renderRules(state);
        });
      });

      renderProperties(state);
      renderRules(state);
      return state;
    };

    const clearSelectorPopup = () => {
      if (!selectorPopupState) {
        return;
      }

      selectorPopupState.container.remove();
      selectorPopupState = null;
      popupTarget = null;
      if (popupFrame !== null) {
        window.cancelAnimationFrame(popupFrame);
        popupFrame = null;
      }
    };

    const updatePopupPosition = () => {
      if (!selectorPopupState || !popupTarget) {
        return;
      }

      if (!popupTarget.isConnected) {
        clearSelectorPopup();
        return;
      }

      const popup = selectorPopupState.container;
      const popupRect = popup.getBoundingClientRect();
      const targetRect = popupTarget.getBoundingClientRect();
      const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const gap = 0.75 * rootFontSize;
      const arrowSize = 0.75 * rootFontSize;

      const spaces = {
        top: targetRect.top,
        bottom: window.innerHeight - targetRect.bottom,
        left: targetRect.left,
        right: window.innerWidth - targetRect.right,
      };

      const fits = {
        top: spaces.top >= popupRect.height + gap + arrowSize * 0.5,
        bottom: spaces.bottom >= popupRect.height + gap + arrowSize * 0.5,
        left: spaces.left >= popupRect.width + gap + arrowSize * 0.5,
        right: spaces.right >= popupRect.width + gap + arrowSize * 0.5,
      };

      const ordered = [
        { key: "top", space: spaces.top },
        { key: "bottom", space: spaces.bottom },
        { key: "left", space: spaces.left },
        { key: "right", space: spaces.right },
      ];

      const candidate = ordered
        .filter((entry) => fits[entry.key as keyof typeof fits])
        .sort((a, b) => b.space - a.space)[0];

      const direction = candidate ? candidate.key : "center";

      popup.classList.remove(
        "pp-selector-popup--top",
        "pp-selector-popup--bottom",
        "pp-selector-popup--left",
        "pp-selector-popup--right",
        "pp-selector-popup--center",
      );
      popup.classList.add(`pp-selector-popup--${direction}`);
      popup.style.setProperty("--pp-arrow-size", `${arrowSize / rootFontSize}rem`);

      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);

      let top = 0;
      let left = 0;

      if (direction === "top") {
        top = targetRect.top - popupRect.height - gap;
        left = targetRect.left + targetRect.width * 0.5 - popupRect.width * 0.5;
      } else if (direction === "bottom") {
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width * 0.5 - popupRect.width * 0.5;
      } else if (direction === "left") {
        top = targetRect.top + targetRect.height * 0.5 - popupRect.height * 0.5;
        left = targetRect.left - popupRect.width - gap;
      } else if (direction === "right") {
        top = targetRect.top + targetRect.height * 0.5 - popupRect.height * 0.5;
        left = targetRect.right + gap;
      } else {
        top = (window.innerHeight - popupRect.height) * 0.5;
        left = (window.innerWidth - popupRect.width) * 0.5;
      }

      const maxLeft = window.innerWidth - popupRect.width - gap;
      const maxTop = window.innerHeight - popupRect.height - gap;
      left = clamp(left, gap, Math.max(gap, maxLeft));
      top = clamp(top, gap, Math.max(gap, maxTop));

      popup.style.left = `${left / rootFontSize}rem`;
      popup.style.top = `${top / rootFontSize}rem`;
      popup.style.visibility = "visible";

      if (direction === "top" || direction === "bottom") {
        const targetCenter = targetRect.left + targetRect.width * 0.5;
        const arrowLeft = clamp(
          targetCenter - left - arrowSize * 0.5,
          gap,
          popupRect.width - gap - arrowSize,
        );
        popup.style.setProperty("--pp-arrow-left", `${arrowLeft / rootFontSize}rem`);
      } else if (direction === "left" || direction === "right") {
        const targetCenter = targetRect.top + targetRect.height * 0.5;
        const arrowTop = clamp(
          targetCenter - top - arrowSize * 0.5,
          gap,
          popupRect.height - gap - arrowSize,
        );
        popup.style.setProperty("--pp-arrow-top", `${arrowTop / rootFontSize}rem`);
      }
    };

    const schedulePopupPosition = () => {
      if (!selectorPopupState) {
        return;
      }

      if (popupFrame !== null) {
        return;
      }

      popupFrame = window.requestAnimationFrame(() => {
        popupFrame = null;
        updatePopupPosition();
      });
    };

    const openSelectorPopup = () => {
      if (!selectedTarget || !selectionEnabled) {
        return;
      }

      if (!selectedTarget.isConnected) {
        return;
      }

      ensureSelectionStyles();
      const info = getElementInfo(selectedTarget);
      const popupState = createSelectorPopup(info);
      if (!popupState) {
        return;
      }

      clearSelectorPopup();
      selectorPopupState = popupState;
      popupTarget = selectedTarget;
      document.body.appendChild(popupState.container);
      popupState.nameInput.focus();
      updatePopupPosition();
    };

    const scheduleLabelUpdate = (target: Element | null) => {
      queuedLabelTarget = target;
      if (labelFrame !== null) {
        return;
      }

      labelFrame = window.requestAnimationFrame(() => {
        labelFrame = null;
        const currentTarget = queuedLabelTarget;
        if (!currentTarget || !selectionEnabled) {
          removeSelectorLabel();
          return;
        }
        if (!currentTarget.isConnected) {
          removeSelectorLabel();
          return;
        }

        const label = ensureSelectorLabel();
        label.textContent = truncate(describeElement(currentTarget));
        const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
        const offset = 0.5 * rootFontSize;
        const maxWidth = Math.max(0, window.innerWidth - offset * 2);
        label.style.maxWidth = `${maxWidth}px`;
        label.style.top = "0px";
        label.style.left = "0px";

        const rect = currentTarget.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const topCandidate = rect.top - labelRect.height - offset;
        const top = topCandidate > offset ? topCandidate : rect.bottom + offset;
        const left = Math.min(Math.max(offset, rect.left), window.innerWidth - labelRect.width - offset);

        label.style.top = `${Math.max(offset, top)}px`;
        label.style.left = `${Math.max(offset, left)}px`;
      });
    };

    const postMessage = (message: SelectToolMessage) => {
      void browser.runtime.sendMessage(message);
    };

    const clearHoverAndNotify = () => {
      clearHover();
      postMessage({ type: "select:hover", payload: null });
    };

    const applySelection = (target: Element) => {
      clearSelectorPopup();
      if (selectedTarget && selectedTarget !== target) {
        selectedTarget.classList.remove(selectedClass);
      }

      selectedTarget = target;
      ensureSelectionStyles();
      selectedTarget.classList.add(selectedClass);

      postMessage({
        type: "select:selected",
        payload: getElementInfo(target),
      });
    };

    const flushHover = () => {
      hoverFrame = null;
      if (!selectionEnabled) {
        return;
      }

      const nextTarget = queuedHoverTarget;
      if (nextTarget === hoverTarget) {
        return;
      }

      if (hoverTarget) {
        hoverTarget.classList.remove(hoverClass);
      }

      hoverTarget = nextTarget;
      if (hoverTarget) {
        ensureSelectionStyles();
        hoverTarget.classList.add(hoverClass);
      }
      scheduleLabelUpdate(hoverTarget);
      postMessage({
        type: "select:hover",
        payload: nextTarget ? getElementInfo(nextTarget) : null,
      });
    };

    const scheduleHover = (target: Element | null) => {
      queuedHoverTarget = target;
      if (hoverFrame !== null) {
        return;
      }

      hoverFrame = window.requestAnimationFrame(flushHover);
    };

    const stopEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!selectionEnabled) {
        return;
      }

      if (isPopupTarget(event.target)) {
        return;
      }

      const target = getEventTarget(event);
      scheduleHover(target);
    };

    const onPointerOut = (event: MouseEvent) => {
      if (!selectionEnabled) {
        return;
      }

      if (event.relatedTarget === null) {
        clearHoverAndNotify();
      }
    };

    const onWindowBlur = () => {
      if (!selectionEnabled) {
        return;
      }

      clearHoverAndNotify();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!selectionEnabled) {
        return;
      }

      if (isPopupTarget(event.target)) {
        return;
      }

      stopEvent(event);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!selectionEnabled) {
        return;
      }

      if (isPopupTarget(event.target)) {
        return;
      }

      stopEvent(event);
    };

    const onClick = (event: MouseEvent) => {
      if (!selectionEnabled) {
        return;
      }

      if (isPopupTarget(event.target)) {
        return;
      }

      const target = getEventTarget(event);
      stopEvent(event);

      if (!target) {
        return;
      }

      if (selectorPopupState) {
        clearSelectorPopup();
      }

      applySelection(target);
    };

    const onViewportChange = () => {
      if (!selectionEnabled) {
        return;
      }

      if (hoverTarget) {
        scheduleLabelUpdate(hoverTarget);
      }

      if (selectorPopupState) {
        schedulePopupPosition();
      }
    };

    const onShortcutKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) {
        return;
      }

      if (event.key === "Escape" && selectorPopupState) {
        clearSelectorPopup();
        return;
      }

      const tool = getShortcutTool(event);
      if (!tool) {
        return;
      }

      const message: SidepanelShortcutMessage = {
        type: "sidepanel:shortcut",
        payload: { tool },
      };
      void browser.runtime.sendMessage(message);
    };

    const attachListeners = () => {
      window.addEventListener("pointermove", onPointerMove, { capture: true });
      window.addEventListener("mouseout", onPointerOut, { capture: true });
      window.addEventListener("blur", onWindowBlur);
      window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: false });
      window.addEventListener("pointerup", onPointerUp, { capture: true, passive: false });
      window.addEventListener("click", onClick, { capture: true, passive: false });
      window.addEventListener("scroll", onViewportChange, { capture: true });
      window.addEventListener("resize", onViewportChange);
    };

    const detachListeners = () => {
      window.removeEventListener("pointermove", onPointerMove, { capture: true });
      window.removeEventListener("mouseout", onPointerOut, { capture: true });
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("pointerup", onPointerUp, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("scroll", onViewportChange, { capture: true });
      window.removeEventListener("resize", onViewportChange);
      clearHover();
      clearSelected();
      clearSelectorPopup();
      queuedHoverTarget = null;
      if (hoverFrame !== null) {
        window.cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
      if (labelFrame !== null) {
        window.cancelAnimationFrame(labelFrame);
        labelFrame = null;
      }
      if (popupFrame !== null) {
        window.cancelAnimationFrame(popupFrame);
        popupFrame = null;
      }
    };

    window.addEventListener("keydown", onShortcutKeyDown, { capture: true });

    browser.runtime.onMessage.addListener((message: SelectToolMessage) => {
      if (message.type === "selector:open") {
        openSelectorPopup();
        return;
      }

      if (message.type === "select:parent") {
        if (!selectionEnabled) {
          return;
        }

        const parent = selectedTarget?.parentElement;
        if (!parent) {
          return;
        }

        clearHoverAndNotify();
        applySelection(parent);
        return;
      }

      if (message.type === "select:toggle") {
        if (message.enabled === selectionEnabled) {
          return;
        }

        selectionEnabled = message.enabled;

        if (selectionEnabled) {
          ensureSelectionStyles();
          attachListeners();
          return;
        }

        detachListeners();
        postMessage({ type: "select:hover", payload: null });
      }
    });

    window.addEventListener("unload", () => {
      window.removeEventListener("keydown", onShortcutKeyDown, { capture: true });
    });
  },
});
