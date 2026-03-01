import { getContext, setContext } from "svelte";
import type { ScriptGrantValue } from "@/lib/grants";

const key = Symbol("grants");

export type GrantRequest = {
  scriptName: string;
  grants: ScriptGrantValue[];
} | null;

export function createGrantsContext() {
  let request = $state<GrantRequest>(null);

  return {
    get request() { return request; },
    set request(v: GrantRequest) { request = v; },
  };
}

export type GrantsContext = ReturnType<typeof createGrantsContext>;

export const setGrantsContext = (ctx: GrantsContext) => setContext(key, ctx);
export const getGrantsContext = () => getContext<GrantsContext>(key);
