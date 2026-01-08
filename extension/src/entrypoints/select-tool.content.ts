import {browser} from 'wxt/browser';
import {defineContentScript} from 'wxt/utils/define-content-script';

import type {ElementInfo, SelectToolMessage} from '../lib/selection';

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
    const classList = Array.from(current.classList).filter(Boolean).slice(0, 2);

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

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    name: element.getAttribute('name') ?? element.getAttribute('aria-label') ?? null,
    className: element.getAttribute('class'),
    selector: getElementSelector(element),
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
  }
});
