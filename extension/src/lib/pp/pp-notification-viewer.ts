const maxViewerDepth = 4;
const maxViewerEntries = 20;

const notificationBodyClass = "pp-page-notification__body";
const notificationValueClass = "pp-page-notification__value";
const notificationKeyClass = "pp-page-notification__key";
const notificationDetailsClass = "pp-page-notification__details";
const notificationSummaryClass = "pp-page-notification__summary";
const notificationNestedClass = "pp-page-notification__nested";
const notificationTruncatedClass = "pp-page-notification__truncated";

const createSpan = (text: string, className?: string) => {
  const element = document.createElement("span");
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
};

const toPropertyName = (key: string | symbol) => (typeof key === "symbol" ? key.toString() : key);

const getSummaryLabel = (value: unknown) => {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (value && typeof value === "object") {
    const constructor = (value as { constructor?: { name?: string } }).constructor;
    const name = constructor?.name || "Object";
    const count = Reflect.ownKeys(value).length;
    return `${name} {${count}}`;
  }
  return "";
};

const formatInline = (value: unknown, seen: WeakSet<object>, depth: number): string => {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") {
    const functionName = (value as { name?: string }).name || "anonymous";
    return `[Function ${functionName}]`;
  }
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (!value || typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  if (depth >= maxViewerDepth) return getSummaryLabel(value);
  return getSummaryLabel(value);
};

const isExpandable = (value: unknown, seen: WeakSet<object>, depth: number) => {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  if (depth >= maxViewerDepth) return false;
  return Array.isArray(value) || value instanceof Error || Reflect.ownKeys(value).length > 0;
};

const createValueNode = (
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  propertyName?: string,
): HTMLElement => {
  const row = document.createElement("div");
  row.className = notificationValueClass;

  if (!isExpandable(value, seen, depth)) {
    if (propertyName) {
      row.appendChild(createSpan(`${propertyName}: `, notificationKeyClass));
    }
    row.appendChild(createSpan(formatInline(value, seen, depth)));
    return row;
  }

  const objectValue = value as object;
  seen.add(objectValue);

  const details = document.createElement("details");
  details.className = notificationDetailsClass;
  const summary = document.createElement("summary");
  summary.className = notificationSummaryClass;
  if (propertyName) {
    summary.appendChild(createSpan(`${propertyName}: `, notificationKeyClass));
  }
  summary.appendChild(createSpan(getSummaryLabel(value)));
  details.appendChild(summary);

  const nested = document.createElement("div");
  nested.className = notificationNestedClass;

  if (Array.isArray(value)) {
    const list = value.slice(0, maxViewerEntries);
    list.forEach((item, index) => {
      nested.appendChild(createValueNode(item, seen, depth + 1, String(index)));
    });
    if (value.length > maxViewerEntries) {
      nested.appendChild(createSpan("...more items", notificationTruncatedClass));
    }
  } else if (value instanceof Error) {
    nested.appendChild(createValueNode(value.name, seen, depth + 1, "name"));
    nested.appendChild(createValueNode(value.message, seen, depth + 1, "message"));
    if (value.stack) {
      nested.appendChild(createValueNode(value.stack, seen, depth + 1, "stack"));
    }
  } else {
    const keys = Reflect.ownKeys(objectValue).slice(0, maxViewerEntries);
    keys.forEach((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
      const entryName = toPropertyName(key);
      if (!descriptor) {
        nested.appendChild(createValueNode(undefined, seen, depth + 1, entryName));
        return;
      }
      if ("value" in descriptor) {
        nested.appendChild(createValueNode(descriptor.value, seen, depth + 1, entryName));
        return;
      }
      const parts: string[] = [];
      if (descriptor.get) parts.push("Getter");
      if (descriptor.set) parts.push("Setter");
      nested.appendChild(createValueNode(`[${parts.join("/")}]`, seen, depth + 1, entryName));
    });
    if (Reflect.ownKeys(objectValue).length > maxViewerEntries) {
      nested.appendChild(createSpan("...more properties", notificationTruncatedClass));
    }
  }

  details.appendChild(nested);
  row.appendChild(details);
  return row;
};

export const buildNotificationBody = (values: unknown[]) => {
  const body = document.createElement("div");
  body.className = notificationBodyClass;

  if (values.length === 0) {
    body.appendChild(createValueNode("Notification", new WeakSet<object>(), 0));
    return body;
  }

  const needsArgLabels = values.length > 1;
  values.forEach((value, index) => {
    const label = needsArgLabels ? `arg${index}` : undefined;
    body.appendChild(createValueNode(value, new WeakSet<object>(), 0, label));
  });
  return body;
};
