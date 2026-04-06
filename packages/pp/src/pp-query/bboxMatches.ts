import { getBoundingBox } from "./_helpers";

export type ElementSize = {
  width: number;
  height: number;
};

const isBoundingBox = (value: unknown): value is ElementSize & { x: number; y: number } =>
  Boolean(
    value &&
    typeof value === "object" &&
    Number.isFinite((value as { x?: unknown }).x) &&
    Number.isFinite((value as { y?: unknown }).y) &&
    Number.isFinite((value as { width?: unknown }).width) &&
    Number.isFinite((value as { height?: unknown }).height),
  );

export const bboxMatches = (element: Element, expectedBox: ElementSize & { x: number; y: number }, tolerance = 75) => {
  if (!isBoundingBox(expectedBox) || !Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }

  const currentBox = getBoundingBox(element);
  const expectedRight = expectedBox.x + expectedBox.width;
  const expectedBottom = expectedBox.y + expectedBox.height;
  const currentRight = currentBox.x + currentBox.width;
  const currentBottom = currentBox.y + currentBox.height;

  return (
    Math.abs(currentBox.x - expectedBox.x) <= tolerance &&
    Math.abs(currentBox.y - expectedBox.y) <= tolerance &&
    Math.abs(currentRight - expectedRight) <= tolerance &&
    Math.abs(currentBottom - expectedBottom) <= tolerance
  );
};
