import type { ChecklistState, WorkflowConfig, WorkflowContext } from "./types";

/**
 * Pure function: derive the workflow status from the current checklist state
 * and the workflow config.
 *
 * Walks the steps in reverse order, applies the optional `condition` predicate
 * (a step whose condition is false is "skipped" — its checkbox is hidden in
 * the UI but doesn't affect status). Returns the status of the highest achieved
 * step, or the config's `initialStatus` if no step is checked.
 *
 * For steps with conditions: if the last step is conditional and its condition
 * is false, the second-to-last step becomes the terminal step and maps to the
 * "Completed" status (the last statusByStep entry).
 *
 * Invariant: `config.statusByStep.length === config.steps.length`.
 *
 * If `waitingOnClient` is true, overrides the derived status to "WaitingOnClient".
 */
export function deriveStatus(
  checklist: ChecklistState,
  config: WorkflowConfig,
  ctx: WorkflowContext,
  waitingOnClient = false
): string {
  if (waitingOnClient) return "WaitingOnClient";

  // Find the last visible step (working backwards).
  let lastVisibleStepIndex = config.steps.length - 1;
  while (lastVisibleStepIndex >= 0) {
    const step = config.steps[lastVisibleStepIndex];
    if (!step.condition || step.condition(ctx)) {
      break; // Found a visible step
    }
    lastVisibleStepIndex--;
  }

  for (let i = config.steps.length - 1; i >= 0; i--) {
    const step = config.steps[i];
    if (step.condition && !step.condition(ctx)) {
      // Skip — this step is hidden.
      continue;
    }
    if (checklist[step.key]) {
      // If the step has a fieldsSatisfied predicate, also check that.
      if (step.fieldsSatisfied && !step.fieldsSatisfied(ctx.fields ?? {})) {
        continue;
      }
      // If this is the last visible step, use the "Completed" status
      // (the last entry in statusByStep), even if it's not the last step in the array.
      if (i === lastVisibleStepIndex) {
        return config.statusByStep[config.statusByStep.length - 1];
      }
      return config.statusByStep[i];
    }
  }
  return config.initialStatus;
}
