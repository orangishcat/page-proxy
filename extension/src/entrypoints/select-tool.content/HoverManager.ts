import log from "loglevel";
import {
  hoverClass,
  hoveredPreviewClass,
  selectedClass,
  styleId,
  selectorLabelId,
  selectionStyles,
} from "@/lib/constants/selection";

const logger = log.getLogger("select-tool");

const uiBaseFontSizePx = 16;
const filteredSelectionClasses = new Set([hoverClass, selectedClass, hoveredPreviewClass]);

const truncate = (value: string, maxLength = 120): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;

const describeElement = (element: Element): string => {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const rawClass = element.getAttribute("class");
  const filteredClass = rawClass
    ? rawClass
        .split(/\s+/)
        .filter((c) => c.length > 0 && !filteredSelectionClasses.has(c))
        .join(".")
    : "";
  return `${tag}${id}${filteredClass ? `.${filteredClass}` : ""}`;
};

export const ensureSelectionStyles = (): void => {
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = selectionStyles;
  (document.head ?? document.documentElement).appendChild(style);
  logger.debug("selection styles injected");
};

const ensureSelectorLabel = (): HTMLDivElement => {
  const existing = document.getElementById(selectorLabelId);
  if (existing) return existing as HTMLDivElement;
  const label = document.createElement("div");
  label.id = selectorLabelId;
  label.className = "pp-selected-label";
  label.dataset.pageProxy = "selector-label";
  document.body.appendChild(label);
  return label;
};

const removeSelectorLabel = (): void => {
  document.getElementById(selectorLabelId)?.remove();
};

export class HoverManager {
  private hoverTarget: Element | null = null;
  private hoverFrame: number | null = null;
  private queuedHoverTarget: Element | null = null;
  private labelFrame: number | null = null;
  private queuedLabelTarget: Element | null = null;

  constructor(
    private readonly isSelectionEnabled: () => boolean,
    private readonly onHoverChange: (element: Element | null) => void,
  ) {}

  scheduleHover(target: Element | null): void {
    this.queuedHoverTarget = target;
    if (this.hoverFrame !== null) return;
    this.hoverFrame = window.requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    this.hoverFrame = null;
    if (!this.isSelectionEnabled()) return;
    const nextTarget = this.queuedHoverTarget;
    if (nextTarget === this.hoverTarget) return;
    if (this.hoverTarget) this.hoverTarget.classList.remove(hoverClass);
    this.hoverTarget = nextTarget;
    if (this.hoverTarget) {
      ensureSelectionStyles();
      this.hoverTarget.classList.add(hoverClass);
    }
    this.scheduleLabelUpdate(this.hoverTarget);
    this.onHoverChange(nextTarget);
  }

  scheduleLabelUpdate(target: Element | null): void {
    this.queuedLabelTarget = target;
    if (this.labelFrame !== null) return;
    this.labelFrame = window.requestAnimationFrame(() => this.flushLabel());
  }

  private flushLabel(): void {
    this.labelFrame = null;
    const currentTarget = this.queuedLabelTarget;
    if (!currentTarget?.isConnected || !this.isSelectionEnabled()) {
      removeSelectorLabel();
      return;
    }
    const label = ensureSelectorLabel();
    label.textContent = truncate(describeElement(currentTarget));
    const offset = uiBaseFontSizePx * 0.5;
    const maxWidth = Math.max(0, window.innerWidth - offset * 2);
    label.style.maxWidth = `${maxWidth}px`;
    label.style.top = "0px";
    label.style.left = "0px";
    const rect = currentTarget.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const topCandidate = rect.top - labelRect.height - offset;
    const top = topCandidate > offset ? topCandidate : rect.bottom + offset;
    const left = Math.min(Math.max(offset, rect.left), window.innerWidth - labelRect.width - offset);
    label.style.top = `${Math.max(offset, top)}px`;
    label.style.left = `${Math.max(offset, left)}px`;
  }

  clearHover(): void {
    if (!this.hoverTarget) return;
    this.hoverTarget.classList.remove(hoverClass);
    this.hoverTarget = null;
    this.queuedLabelTarget = null;
    removeSelectorLabel();
  }

  clearHoverAndNotify(): void {
    this.clearHover();
    this.onHoverChange(null);
  }

  refreshLabel(): void {
    if (this.hoverTarget) {
      this.scheduleLabelUpdate(this.hoverTarget);
    }
  }

  dispose(): void {
    this.clearHover();
    this.queuedHoverTarget = null;
    if (this.hoverFrame !== null) {
      window.cancelAnimationFrame(this.hoverFrame);
      this.hoverFrame = null;
    }
    if (this.labelFrame !== null) {
      window.cancelAnimationFrame(this.labelFrame);
      this.labelFrame = null;
    }
  }
}
