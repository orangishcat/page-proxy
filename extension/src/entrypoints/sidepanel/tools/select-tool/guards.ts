import type {
  ElementInfo,
  SelectElementActionResult,
  SelectToolMessage,
  SelectorOpenResult,
} from "@/lib/selection";
import { isRecord } from "@/lib/utils/type-guards";

const hasType = <T extends string>(value: unknown, type: T): value is { type: T } =>
  isRecord(value) && value.type === type;

export const isSelectorOpenResult = (value: unknown): value is SelectorOpenResult =>
  isRecord(value) && typeof value.opened === "boolean";

export const isSelectElementActionResult = (value: unknown): value is SelectElementActionResult =>
  isRecord(value) &&
  typeof value.ok === "boolean" &&
  (value.ok === true || (typeof value.error === "string" && value.error.length > 0));

export const isElementInfo = (value: unknown): value is ElementInfo => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.tag === "string" &&
    (value.id === null || typeof value.id === "string") &&
    typeof value.selector === "string" &&
    isRecord(value.attributes) &&
    isRecord(value.boundingBox)
  );
};

export const isSelectParentResponse = (value: unknown): value is { ok: boolean; payload?: ElementInfo; error?: string } => {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.payload !== undefined && !isElementInfo(value.payload)) {
    return false;
  }

  return value.error === undefined || typeof value.error === "string";
};

export const isSelectToolMessage = (value: unknown): value is SelectToolMessage =>
  hasType(value, "select:mode") ||
  hasType(value, "select:hover") ||
  hasType(value, "select:selected") ||
  hasType(value, "selectors:hover") ||
  hasType(value, "select:toggle") ||
  hasType(value, "select:parent") ||
  hasType(value, "select:restore") ||
  hasType(value, "select:clear") ||
  hasType(value, "select:action") ||
  hasType(value, "selector:open");
