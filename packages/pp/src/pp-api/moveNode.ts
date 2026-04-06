export type MoveNodePasteLocation = "child" | "before" | "after";
export type MoveNodeOptions = {
  pasteLocation?: MoveNodePasteLocation;
  copy?: boolean;
};

export const moveNode = (
  node: Element,
  position = -1,
  parent: Element | null = node.parentElement,
  options: MoveNodeOptions = {},
) => {
  const { pasteLocation = "child", copy = false } = options;
  const nextNode = (copy ? node.cloneNode(true) : node) as Element;

  if (!parent) {
    return nextNode;
  }

  if (pasteLocation === "before" || pasteLocation === "after") {
    const anchor = parent;
    const anchorParent = anchor.parentElement;
    if (!anchorParent) {
      return nextNode;
    }

    const referenceNode = pasteLocation === "before" ? anchor : anchor.nextSibling;
    anchorParent.insertBefore(nextNode, referenceNode);
    return nextNode;
  }

  const siblings = copy
    ? Array.from(parent.children)
    : Array.from(parent.children).filter((child) => child !== node);
  const siblingCount = siblings.length;
  const normalizedPosition = Math.min(
    Math.max(position < 0 ? siblingCount + position + 1 : position, 0),
    siblingCount,
  );
  const target = siblings[normalizedPosition] ?? null;

  parent.insertBefore(nextNode, target);
  return nextNode;
};
