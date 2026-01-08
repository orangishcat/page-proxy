import {defineBackground} from 'wxt/utils/define-background';

import {browser} from 'wxt/browser';

export default defineBackground(() => {
  const sidePanel = browser.sidePanel;
  if (sidePanel?.setPanelBehavior) {
    void sidePanel.setPanelBehavior({openPanelOnActionClick: true});
  }

  const sidebarAction = (
    browser as typeof browser & {
      sidebarAction?: {
        open: () => Promise<void>;
      };
    }
  ).sidebarAction;

  if (sidebarAction?.open) {
    browser.action.onClicked.addListener(() => {
      void sidebarAction.open();
    });
  }
});
