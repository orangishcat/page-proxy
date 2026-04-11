import type { SupportedRecordStep, SupportedRecordStepKind } from "../normalize";
import { ApplyStyleElementStep } from "./steps/apply-style-element";
import { ClickElementStep } from "./steps/click-element";
import { CopyElementStep } from "./steps/copy-element";
import { CutElementStep } from "./steps/cut-element";
import { DeleteElementStep } from "./steps/delete-element";
import { HideElementStep } from "./steps/hide-element";
import { PasteElementStep } from "./steps/paste-element";
import { SelectElementStep } from "./steps/select-element";
import { SelectParentStep } from "./steps/select-parent";
import type { ParentTraversalOption, SelectElementOption, StepGenerator } from "./types";

const stepCtors: Record<
  SupportedRecordStepKind,
  (step: SupportedRecordStep, parentOpt: ParentTraversalOption, selectOpt: SelectElementOption) => StepGenerator
> = {
  "select-element": (step, _parent, select) => new SelectElementStep(step, select),
  "select-parent": (step, parent) => new SelectParentStep(step, parent),
  "click-element": (step) => new ClickElementStep(step),
  "delete-element": (step) => new DeleteElementStep(step),
  "cut-element": (step) => new CutElementStep(step),
  "copy-element": (step) => new CopyElementStep(step),
  "paste-element": (step) => new PasteElementStep(step),
  "hide-element": (step) => new HideElementStep(step),
  "apply-style-element": (step) => new ApplyStyleElementStep(step),
};

export const createStep = (
  step: SupportedRecordStep,
  parentOpt: ParentTraversalOption,
  selectOpt: SelectElementOption,
): StepGenerator => stepCtors[step.kind](step, parentOpt, selectOpt);
