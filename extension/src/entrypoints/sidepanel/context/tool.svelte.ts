import { getContext, setContext } from "svelte";
import type { ToolId } from "../tools/state-storage";

const key = Symbol("tool");

export function createToolContext() {
  let activeTool = $state<ToolId>("none");

  return {
    get activeTool() { return activeTool; },
    set activeTool(v: ToolId) { activeTool = v; },
  };
}

export type ToolContext = ReturnType<typeof createToolContext>;

export const setToolContext = (ctx: ToolContext) => setContext(key, ctx);
export const getToolContext = () => getContext<ToolContext>(key);
