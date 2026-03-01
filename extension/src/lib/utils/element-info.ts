import type { ElementInfo } from "@/lib/selection";

export type PropertyItem = {
  key: string;
  label: string;
  value: string;
  rawValue: string | ElementInfo["boundingBox"];
  primary: boolean;
};

export const formatBoundingBoxCompact = (box: ElementInfo["boundingBox"]): string =>
  `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.width.toFixed(2)}, ${box.height.toFixed(2)}`;

export const getPrimaryPropertyItems = (info: ElementInfo): PropertyItem[] => {
  const items: PropertyItem[] = [];

  if (info.tag) {
    items.push({ key: "tag", label: "Tag", value: info.tag, rawValue: info.tag, primary: true });
  }
  if (info.id) {
    items.push({ key: "id", label: "ID", value: info.id, rawValue: info.id, primary: true });
  }
  if (info.className) {
    items.push({ key: "class", label: "Class", value: info.className, rawValue: info.className, primary: true });
  }
  if (info.name) {
    items.push({ key: "name", label: "Name", value: info.name, rawValue: info.name, primary: true });
  }

  items.push({ key: "selector", label: "Selector", value: info.selector, rawValue: info.selector, primary: true });
  items.push({
    key: "bbox",
    label: "BBox",
    value: formatBoundingBoxCompact(info.boundingBox),
    rawValue: info.boundingBox,
    primary: true,
  });

  if (info.innerText) {
    items.push({ key: "innerText", label: "Inner text", value: info.innerText, rawValue: info.innerText, primary: false });
  }

  return items;
};

export const buildPropertyList = (info: ElementInfo | null): PropertyItem[] => {
  if (!info) {
    return [];
  }

  const properties = getPrimaryPropertyItems(info);
  const reservedKeys = new Set(["id", "class", "name", "tag", "selector"]);

  Object.entries(info.attributes)
    .filter(([key, value]) => !reservedKeys.has(key) && value.length > 0)
    .forEach(([key, value]) => {
      properties.push({ key, label: key, value, rawValue: value, primary: false });
    });

  return properties;
};
