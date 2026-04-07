import type {ElementInfo} from "@/lib/selection";

export type FilterOperator = "contains" | "matches" | "keyExists";
export type SpecialPropertyKey = "tag" | "selector" | "bbox" | "innerText";

export type PreviewPropertyItem = {
  key: string;
  value: string;
  rawValue: string | ElementInfo["boundingBox"];
};

export const filterFunctionMap: Record<FilterOperator, string> = {
  contains: "propContains",
  matches: "propMatches",
  keyExists: "propExists",
};

const specialPropertyKeys = new Set<SpecialPropertyKey>(["tag", "selector", "bbox", "innerText"]);

export const isSpecialPropertyKey = (key: string | null): key is SpecialPropertyKey =>
  Boolean(key && specialPropertyKeys.has(key as SpecialPropertyKey));

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const buildInnerTextRegexLiteral = (value: string) => {
  const normalizedValue = value.replace(/\r\n?/g, "\n");
  const hasNewline = normalizedValue.includes("\n");
  const escapedValue = escapeRegExp(normalizedValue).replace(/\n/g, "\\n");
  return `/${escapedValue}/${hasNewline ? "m" : ""}`;
};

const buildSpecialPreviewCode = (item: PreviewPropertyItem) => {
  if (item.key === "tag") {
    return `pq.tagMatches(e, ${JSON.stringify(item.value)})`;
  }
  if (item.key === "selector") {
    return `pq.selectorMatches(e, ${JSON.stringify(item.value)})`;
  }
  if (item.key === "innerText") {
    return `pq.innerTextMatches(e, ${buildInnerTextRegexLiteral(item.value)})`;
  }
  if (item.key === "bbox" && typeof item.rawValue !== "string") {
    const roundedBox = {
      x: Math.round(item.rawValue.x),
      y: Math.round(item.rawValue.y),
      width: Math.round(item.rawValue.width),
      height: Math.round(item.rawValue.height),
    };

    return `pq.bboxMatches(e, ${JSON.stringify(roundedBox)}, 75)`;
  }

  return `pq.propMatches(e, ${JSON.stringify(item.key)}, ${JSON.stringify(item.value)})`;
};

export const buildPreviewCode = (item: PreviewPropertyItem | null, filterOperator: FilterOperator) => {
  if (item && isSpecialPropertyKey(item.key)) {
    return buildSpecialPreviewCode(item);
  }

  const propertyKey = item?.key ?? "selectedPropertyName";
  if (filterOperator === "keyExists") {
    return `pq.${filterFunctionMap[filterOperator]}(e, ${JSON.stringify(propertyKey)})`;
  }

  const propertyValue = item?.value ?? "selectedPropertyValue";
  return (
    `pq.${filterFunctionMap[filterOperator]}(` +
    `e, ${JSON.stringify(propertyKey)}, ${JSON.stringify(propertyValue)})`
  );
};
