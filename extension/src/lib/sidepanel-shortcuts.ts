export type SidepanelShortcutId = 'select' | 'create' | 'selectors' | 'help' | 'share';

export type SidepanelShortcutMessage = {
  type: 'sidepanel:shortcut';
  payload: {
    tool: SidepanelShortcutId;
  };
};

export const isSidepanelShortcutMessage = (
  message: unknown
): message is SidepanelShortcutMessage => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const payload = (message as {payload?: unknown}).payload;
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return (message as {type?: string}).type === 'sidepanel:shortcut' &&
    typeof (payload as {tool?: unknown}).tool === 'string';
};
