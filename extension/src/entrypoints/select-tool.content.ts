import {browser} from 'wxt/browser';
import {defineContentScript} from 'wxt/utils/define-content-script';

import type {ElementInfo, SelectToolMessage} from '@/lib/selection';
import type {SidepanelShortcutId, SidepanelShortcutMessage} from '@/lib/sidepanel-shortcuts';

const hoverClass = 'pp-hover';
const selectedClass = 'pp-selected';
const styleId = 'page-proxy-selection-styles';
const selectorLabelId = 'page-proxy-selector-label';
const selectionStyles = `
.pp-hover {
  outline: 0.125rem solid #86d24b !important;
  outline-offset: 0.125rem !important;
}
.pp-selected {
  outline: 0.125rem solid #bb9348 !important;
  outline-offset: 0.125rem !important;
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
  const innerText =
    element instanceof HTMLElement ? element.innerText.trim() : '';
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
    innerText: innerText.length > 0 && innerText.length < 500 ? innerText : null,
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

const truncate = (value: string, maxLength = 120) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

const describeElement = (element: Element) => {
  const info = getElementInfo(element);
  return `${info.tag}${info.id ? `#${info.id}` : ''}${info.className ? `.${info.className.replace(' ', '.')}` : ''}`;
}

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
    let labelFrame: number | null = null;
    let queuedLabelTarget: Element | null = null;

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

    const ensureSelectorLabel = () => {
      const existing = document.getElementById(selectorLabelId);
      if (existing) {
        return existing as HTMLDivElement;
      }

      const label = document.createElement('div');
      label.id = selectorLabelId;
      label.className = 'pp-selected-label';
      label.dataset.pageProxy = 'selector-label';
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
        const rootFontSize = Number.parseFloat(
          window.getComputedStyle(document.documentElement).fontSize
        ) || 16;
        const offset = 0.5 * rootFontSize;
        const maxWidth = Math.max(0, window.innerWidth - offset * 2);
        label.style.maxWidth = `${maxWidth}px`;
        label.style.top = '0px';
        label.style.left = '0px';

        const rect = currentTarget.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const topCandidate = rect.top - labelRect.height - offset;
        const top = topCandidate > offset ? topCandidate : rect.bottom + offset;
        const left = Math.min(
          Math.max(offset, rect.left),
          window.innerWidth - labelRect.width - offset
        );

        label.style.top = `${Math.max(offset, top)}px`;
        label.style.left = `${Math.max(offset, left)}px`;
      });
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
      scheduleLabelUpdate(hoverTarget);
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

    const onViewportChange = () => {
      if (!selectionEnabled || !hoverTarget) {
        return;
      }

      scheduleLabelUpdate(hoverTarget);
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
      window.addEventListener('scroll', onViewportChange, {capture: true});
      window.addEventListener('resize', onViewportChange);
    };

    const detachListeners = () => {
      window.removeEventListener('pointermove', onPointerMove, {capture: true});
      window.removeEventListener('mouseout', onPointerOut, {capture: true});
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('pointerdown', onPointerDown, {capture: true});
      window.removeEventListener('pointerup', onPointerUp, {capture: true});
      window.removeEventListener('click', onClick, {capture: true});
      window.removeEventListener('scroll', onViewportChange, {capture: true});
      window.removeEventListener('resize', onViewportChange);
      clearHover();
      clearSelected();
      queuedHoverTarget = null;
      if (hoverFrame !== null) {
        window.cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
      }
      if (labelFrame !== null) {
        window.cancelAnimationFrame(labelFrame);
        labelFrame = null;
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
