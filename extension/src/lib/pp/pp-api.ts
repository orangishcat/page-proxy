import * as pq from "./pp-query";
import * as ps from "./pp-style";
import { pqSelectorReference } from "./function-references";
import type { ScriptRunLogLevel } from "../script-runner";

export const notificationSinkGlobalKey = "__pageProxyNotificationSink__";

type NotificationSink = (payload: { level: ScriptRunLogLevel; values: unknown[] }) => void;

const getNotificationSink = () => {
  const sink = (globalThis as Record<string, unknown>)[notificationSinkGlobalKey];
  return typeof sink === "function" ? (sink as NotificationSink) : null;
};

export const notification = (...values: unknown[]) => {
  console.log(...values);
  const sink = getNotificationSink();
  if (!sink) {
    return;
  }
  sink({
    level: "notification",
    values,
  });
};

export const createApi = () => ({
  element: pq.element,
  selector: pq.selector,
  applyStyle: ps.applyStyle,
  notification,
  propMatches: pq.propMatches,
  propContains: pq.propContains,
  propExists: pq.propExists,
  tagMatches: pq.tagMatches,
  selectorMatches: pq.selectorMatches,
  innerTextMatches: pq.innerTextMatches,
  bboxMatches: pq.bboxMatches,
});

export const pp = createApi();

export const pageModificationFunctions = [
  "pa.element",
  "pa.notification",
  pqSelectorReference,
  "ps.applyStyle",
  "pq.propMatches",
  "pq.propContains",
  "pq.propExists",
  "pq.tagMatches",
  "pq.selectorMatches",
  "pq.innerTextMatches",
  "pq.bboxMatches",
];
