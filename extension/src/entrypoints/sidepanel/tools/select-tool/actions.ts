import {browser} from 'wxt/browser';
import type {SelectToolMessage} from '@/lib/selection';
import {setErrorMessage} from '../tool-errors';
import {setSelection} from './state';

const isRestrictedUrl = (url: string | undefined) => {
  if (!url) {
    return true;
  }

  const normalized = url.toLowerCase();
  return (
    normalized.startsWith('chrome://') ||
    normalized.startsWith('brave://') ||
    normalized.startsWith('edge://') ||
    normalized.startsWith('about:') ||
    normalized.startsWith('chrome-extension://') ||
    normalized.startsWith('moz-extension://') ||
    normalized.startsWith('view-source:')
  );
};

const injectSelectTool = (tabId: number) =>
  browser.scripting.executeScript({
    target: {tabId, allFrames: true},
    files: ['content-scripts/select-tool.js']
  });

export const sendSelectionToggle = (enabled: boolean) => {
  const shouldReportError = enabled;
  setErrorMessage(null);

  void browser.tabs
    .query({active: true, currentWindow: true})
    .then((tabs) => {
      const activeTab = tabs[0];
      const tabId = activeTab?.id;
      if (tabId === undefined) {
        if (shouldReportError) {
          setErrorMessage('No active tab found.');
        }
        return;
      }

      if (shouldReportError && isRestrictedUrl(activeTab?.url)) {
        setErrorMessage('Selection is unavailable on this page.');
        return;
      }

      return browser.tabs
        .sendMessage(tabId, {
          type: 'select:toggle',
          enabled
        } satisfies SelectToolMessage)
        .catch(() => {
          if (!shouldReportError) {
            return;
          }

          return injectSelectTool(tabId)
            .then(() =>
              browser.tabs.sendMessage(tabId, {
                type: 'select:toggle',
                enabled
              } satisfies SelectToolMessage)
            )
            .catch(() => {
              setErrorMessage('Unable to connect to the active tab.');
            });
        });
    })
    .catch(() => {
      if (!shouldReportError) {
        return;
      }

      setErrorMessage('Unable to connect to the active tab.');
    });
};

export const attachSelectionListener = () => {
  const listener = (message: SelectToolMessage) => {
    if (message.type === 'select:hover') {
      return;
    }

    if (message.type === 'select:selected') {
      setSelection(message.payload ?? null);
      setErrorMessage(null);
    }
  };

  browser.runtime.onMessage.addListener(listener);

  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
};
