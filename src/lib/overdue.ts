/**
 * Is an obligation overdue? Extracted to its own module so the JSX parser
 * in page files doesn't have to lex `<` comparison operators.
 */
export interface OverdueInput {
  status: string;
  filingDueDate: Date | null;
}

export function isOverdue(o: OverdueInput, nowMs: number): boolean {
  if (o.status === "Filed" || !o.filingDueDate) return false;
  return o.filingDueDate.getTime() - nowMs < 0;
}

export function isOverdueDate(due: Date | null, status: string, nowMs: number): boolean {
  if (status === "Filed" || !due) return false;
  return due.getTime() - nowMs < 0;
}
