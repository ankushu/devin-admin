import type { IOrgRegistry } from '../orgs/IOrgRegistry.js';

// Formats a billing_org_id for display as "name (org_id)", falling back to
// just the id if the org isn't in the local cache, or undefined if there's no id.
export async function formatBillingOrg(
  orgRegistry: IOrgRegistry,
  orgId: string | undefined
): Promise<string | undefined> {
  if (!orgId) return undefined;
  const name = await orgRegistry.resolveName(orgId);
  return name ? `${name} (${orgId})` : orgId;
}
