import * as pq from "./pp-query";
import * as ps from "./pp-style";
import { pqSelectorReference } from "./function-references";

export const createApi = () => ({
  element: pq.element,
  selector: pq.selector,
  applyStyle: ps.applyStyle,
  propMatches: pq.propMatches,
  propContains: pq.propContains,
  propExists: pq.propExists,
});

export const pp = createApi();

export const pageModificationFunctions = [
  "pa.element",
  pqSelectorReference,
  "ps.applyStyle",
  "pq.propMatches",
  "pq.propContains",
  "pq.propExists",
];
