import {browser} from 'wxt/browser';
import {defineContentScript} from 'wxt/utils/define-content-script';

import type {ElementInfo, SelectToolMessage} from '@/lib/selection';
import type {SidepanelShortcutId, SidepanelShortcutMessage} from '@/lib/sidepanel-shortcuts';

const hoverClass = 'pp-hover';
const selectedClass = 'pp-selected';
const styleId = 'page-proxy-selection-styles';
const selectionStyles = `
.pp-hover {
  outline: 0.125rem solid #86d24b !important;
  outline-offset: 0.125rem !important;
}
.pp-selected {
  outline: 0.125rem solid #bb9348 !important;
  outline-offset: 0.125rem !important;
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

  return tokens.length > 0 ? tokens.join(' ') : null;
};

const escapeSelector = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
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
      segment += `.${classList.map(escapeSelector).join('.')}`;
    }

    const parent = current.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (child) => child instanceof Element && child.tagName === current?.tagName
      );

      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }

    segments.unshift(segment);

    if (current.tagName.toLowerCase() === 'body') {
      break;
    }

    current = current.parentElement;
  }

  return segments.join(' > ');
};

const getElementInfo = (element: Element): ElementInfo => {
  const rect = element.getBoundingClientRect();
  const attributes = Object.fromEntries(
    Array.from(element.attributes)
      .map((attr) => {
        if (attr.name === 'class') {
          const filtered = filterSelectionClasses(attr.value);
          return filtered ? ([attr.name, filtered] as const) : null;
        }

        return [attr.name, attr.value] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null)
  );

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    name: element.getAttribute('name') ?? element.getAttribute('aria-label') ?? null,
    className: filterSelectionClasses(element.getAttribute('class')),
    selector: getElementSelector(element),
    attributes,
    boundingBox: {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height
    }
  };
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
    case 'Digit1':
      return 'select';
    case 'Digit2':
      return 'new-element';
    case 'Digit3':
      return 'styles';
    case 'Digit4':
      return 'help';
    case 'Digit5':
      return 'share';
    default:
      return null;
  }
};

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let selectionEnabled = false;
    let hoverTarget: Element | null = null;
    let selectedTarget: Element | null = null;
    let hoverFrame: number | null = null;
    let queuedHoverTarget: Element | null = null;

    const ensureSelectionStyles = () => {
      if (document.getElementById(styleId)) {
        return;
      }

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = selectionStyles;
      const container = document.head ?? document.documentElement;
      container.appendChild(style);
    };

    const clearHover = () => {
      if (!hoverTarget) {
        return;
      }

      hoverTarget.classList.remove(hoverClass);
      hoverTarget = null;
    };

    const clearSelected = () => {
      if (!selectedTarget) {
        return;
      }

      selectedTarget.classList.remove(selectedClass);
      selectedTarget = null;
    };

    const postMessage = (message: SelectToolMessage) => {
      void browser.runtime.sendMessage(message);
    };

    const clearHoverAndNotify = () => {
      clearHover();
      postMessage({type: 'select:hover', payload: null});
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
      postMessage({
        type: 'select:hover',
        payload: nextTarget ? getElementInfo(nextTarget) : null
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

      stopEvent(event);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!selectionEnabled) {
        return;
      }

      stopEvent(event);
    };

    const onClick = (event: MouseEvent) => {
      if (!selectionEnabled) {
        return;
      }

      const target = getEventTarget(event);
      stopEvent(event);

      if (!target) {
        return;
      }

      if (selectedTarget && selectedTarget !== target) {
        selectedTarget.classList.remove(selectedClass);
      }

      selectedTarget = target;
      ensureSelectionStyles();
      selectedTarget.classList.add(selectedClass);

      postMessage({
        type: 'select:selected',
        payload: getElementInfo(target)
      });
    };

    const onShortcutKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) {
        return;
      }

      const tool = getShortcutTool(event);
      if (!tool) {
        return;
      }

      const message: SidepanelShortcutMessage = {
        type: 'sidepanel:shortcut',
        payload: {tool}
      };
      void browser.runtime.sendMessage(message);
    };

    const attachListeners = () => {
      window.addEventListener('pointermove', onPointerMove, {capture: true});
      window.addEventListener('mouseout', onPointerOut, {capture: true});
      window.addEventListener('blur', onWindowBlur);
      window.addEventListener('pointerdown', onPointerDown, {capture: true, passive: false});
      window.addEventListener('pointerup', onPointerUp, {capture: true, passive: false});
      window.addEventListener('click', onClick, {capture: true, passive: false});
    };

    const detachListeners = () => {
      window.removeEventListener('pointermove', onPointerMove, {capture: true});
      window.removeEventListener('mouseout', onPointerOut, {capture: true});
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('pointerdown', onPointerDown, {capture: true});
      window.removeEventListener('pointerup', onPointerUp, {capture: true});
      window.removeEventListener('click', onClick, {capture: true});
      clearHover();
      clearSelected();
      queuedHoverTarget = null;
      if (hoverFrame !== null) {
        window.cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
    };

    window.addEventListener('keydown', onShortcutKeyDown, {capture: true});

    browser.runtime.onMessage.addListener((message: SelectToolMessage) => {
      if (message.type !== 'select:toggle') {
        return;
      }

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
      postMessage({type: 'select:hover', payload: null});
    });

    window.addEventListener('unload', () => {
      window.removeEventListener('keydown', onShortcutKeyDown, {capture: true});
    });
  }
});
