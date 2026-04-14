import { getContext, setContext } from "svelte";
import { appStateActions, appStateSelectors } from "../../../lib/app-state.ts";
import type { ToolId } from "../tools/state-storage";

const key = Symbol("tool");

export function createToolContext() {
  return {
    get activeTool() {
      return appStateSelectors.getActiveTool();
    },
    set activeTool(v: ToolId) {
      const activeScript = appStateSelectors.getActiveScript();
      if (!activeScript) {
        return;
      }

      appStateActions.updateActiveScript((script) => ({
        ...script,
        activeTool: v,
        updatedAt: Date.now(),
      }));
    },
    get showHelpButton() {
      return appStateSelectors.getShowHelpButton();
    },
    set showHelpButton(v: boolean) {
      appStateActions.setShowHelpButton(v);
    },
  };
}

export type ToolContext = ReturnType<typeof createToolContext>;

export const setToolContext = (ctx: ToolContext) => setContext(key, ctx);
export const getToolContext = () => getContext<ToolContext>(key);
