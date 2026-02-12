import * as pq from "./pp-query";

const buildModuleFunctionReference = (moduleName: string, fn: { name: string }, fallbackName: string) =>
  `${moduleName}.${fn.name || fallbackName}`;

export const pqSelectorReference = buildModuleFunctionReference("pq", pq.selector, "selector");
