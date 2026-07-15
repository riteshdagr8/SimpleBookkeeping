import type { ChecklistState, WorkflowConfig, WorkflowContext } from "./types";

/**
 * Pure function: derive the workflow status from the current checklist state
 * and the workflow config.
 *
 * Walks the steps in reverse order, applies the optional `condition` predicate
 * (a step whose condition is false is "skipped" — its checkbox is treated as
 * always-true for status-derivation purposes but its own checkbox is hidden
 * in the UI). Returns the status of the highest achieved step, or the config's
 * `initialStatus` if no step is checked.
 *
 * Invariant: `config.statusByStep.length === config.steps.length`. The status
 * for the LAST step is the terminal "Completed" value. The CONDITIONAL last
 * step (e.g. Payroll's "remittances submitted" hidden when !qbOnlinePayroll)
 * becomes the terminal step in that case.
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

  for (let i = config.steps.length - 1; i >= 0; i--) {
    const step = config.steps[i];
    if (step.condition && !step.condition(ctx)) {
      // Skip — this step is hidden. Its absence doesn't lower the achieved
      // status; the *next* unchecked visible step defines the boundary.
      continue;
    }
    if (checklist[step.key]) {
      // If the step has a fieldsSatisfied predicate, also check that.
      if (step.fieldsSatisfied && !step.fieldsSatisfied(ctx.fields ?? {})) {
        continue;
      }
      return config.statusByStep[i];
    }
  }
  return config.initialStatus;
}
