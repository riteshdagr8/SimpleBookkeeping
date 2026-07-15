import { getConfigByFilingType } from "./configs";

/**
 * Map an obligation's `filingType` to a workflow page URL slug, or null if
 * there is no workflow for that type.
 */
export function filingTypeToSlug(filingType: string): string | null {
  const c = getConfigByFilingType(filingType);
  return c ? c.slug : null;
}

/**
 * Build a relative link to the workflow detail page for an obligation.
 * Returns null if the filing type has no workflow.
 */
export function workflowLinkForObligation(
  filingType: string,
  obligationId: string
): string | null {
  const slug = filingTypeToSlug(filingType);
  if (!slug) return null;
  return `/${slug}/${obligationId}`;
}
