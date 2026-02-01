import {browser} from 'wxt/browser';
import log from 'loglevel';

export type SidePanelOpenTabs = Record<string, boolean>;

export const sidePanelStorageKey = 'sidepanel:openTabs';

const logger = log.getLogger('sidepanel-state');
logger.setLevel('debug', false);

const coerceOpenTabs = (value: unknown): SidePanelOpenTabs => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([, entryValue]) =>
    typeof entryValue === 'boolean'
  );

  return Object.fromEntries(entries) as SidePanelOpenTabs;
};

export const readSidePanelOpenTabs = async (): Promise<SidePanelOpenTabs> => {
  return browser.storage.session
    .get(sidePanelStorageKey)
    .then((stored) => {
      const openTabs = coerceOpenTabs(stored[sidePanelStorageKey]);
      logger.debug('readSidePanelOpenTabs', {openTabs});
      return openTabs;
    })
    .catch((error) => {
      logger.error('readSidePanelOpenTabs failed', error);
      throw error;
    });
};

export const writeSidePanelOpenTabs = async (openTabs: SidePanelOpenTabs) =>
  browser.storage.session
    .set({[sidePanelStorageKey]: openTabs})
    .then(() => {
      logger.debug('writeSidePanelOpenTabs', {openTabs});
    })
    .catch((error) => {
      logger.error('writeSidePanelOpenTabs failed', {openTabs, error});
      throw error;
    });

export const setSidePanelOpenForTab = async (tabId: number, isOpen: boolean) => {
  logger.debug('setSidePanelOpenForTab start', {tabId, isOpen});
  const current = await readSidePanelOpenTabs();
  const key = String(tabId);
  const next = {...current};

  if (isOpen) {
    next[key] = true;
  } else {
    delete next[key];
  }

  await writeSidePanelOpenTabs(next);
  logger.debug('setSidePanelOpenForTab done', {tabId, isOpen, openTabs: next});
  return next;
};

export const isSidePanelOpenForTab = async (tabId: number) => {
  const openTabs = await readSidePanelOpenTabs();
  const isOpen = Boolean(openTabs[String(tabId)]);
  logger.debug('isSidePanelOpenForTab', {tabId, isOpen});
  return isOpen;
};
