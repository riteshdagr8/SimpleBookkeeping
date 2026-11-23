/**
 * Is an obligation overdue? Extracted to its own module so the JSX parser
 * in page files doesn't have to lex `<` comparison operators.
 */
export interface OverdueInput {
  status: string;
  filingDueDate: Date | null;
}

export function isOverdue(o: OverdueInput, nowMs: number): boolean {
  // "Filed/Completed" (app status) and "Completed" (workflow status) are done;
  // a cancelled row is not an outstanding deadline.
  if (o.status === "Filed/Completed" || o.status === "Completed" || o.status === "Cancelled" || !o.filingDueDate) return false;
  return o.filingDueDate.getTime() - nowMs < 0;
}
