import type { MembersApi } from '../api/MembersApi.js';
import type { OrgRegistry } from '../orgs/OrgRegistry.js';
import type { UserResolver } from '../users/UserResolver.js';
import type { AcuLimitService } from './AcuLimitService.js';
import { renderDryRun } from '../utils/output.js';

// Membership in this org (typically admins) is never removed by an automatic move.
const PROTECTED_ORG_NAME = 'Service Now';

export class MembershipService {
  constructor(
    private readonly membersApi: MembersApi,
    private readonly orgRegistry: OrgRegistry,
    private readonly userResolver: UserResolver,
    private readonly acuLimitService: AcuLimitService
  ) {}

  async getUser(emailOrId: string): Promise<import('../models/types.js').User> {
    if (emailOrId.includes('@')) {
      const users = await this.membersApi.listEnterpriseMembers(emailOrId);
      if (users.length === 0) throw new Error(`No user found with email: ${emailOrId}`);
      return users[0];
    }
    const all = await this.membersApi.listEnterpriseMembers();
    const user = all.find((u) => u.user_id === emailOrId);
    if (!user) throw new Error(`No user found with id: ${emailOrId}`);
    return user;
  }

  async listOrgUsers(orgNameOrId: string): Promise<import('../models/types.js').User[]> {
    const org = await this.orgRegistry.resolve(orgNameOrId);
    return this.membersApi.listOrgMembers(org.org_id);
  }

  async assignOrg(
    emailOrId: string,
    orgNameOrId: string,
    opts: { role?: string; dryRun?: boolean } = {}
  ): Promise<void> {
    const [userId, org] = await Promise.all([
      this.userResolver.resolveId(emailOrId),
      this.orgRegistry.resolve(orgNameOrId),
    ]);
    const body = {
      user_ids: [userId],
      org_ids: [org.org_id],
      ...(opts.role ? { org_role: opts.role } : {}),
    };

    if (opts.dryRun) {
      renderDryRun('POST', `/v2/enterprise/organizations/${org.org_id}/members`, body);
      return;
    }
    await this.membersApi.addToOrgs(org.org_id, body);
  }

  async removeOrg(
    emailOrId: string,
    orgNameOrId: string,
    opts: { dryRun?: boolean; confirm?: (message: string) => Promise<boolean> } = {}
  ): Promise<{ removed: boolean }> {
    const [userId, org] = await Promise.all([
      this.userResolver.resolveId(emailOrId),
      this.orgRegistry.resolve(orgNameOrId),
    ]);

    let protectedOrgId: string | null = null;
    try {
      protectedOrgId = (await this.orgRegistry.resolve(PROTECTED_ORG_NAME)).org_id;
    } catch {
      protectedOrgId = null;
    }

    let billingOrgId: string | undefined;
    try {
      const acu = await this.acuLimitService.getUser(userId);
      billingOrgId = acu.local_agent?.billing_org_id;
    } catch {
      billingOrgId = undefined;
    }

    const warnings: string[] = [];
    if (protectedOrgId && org.org_id === protectedOrgId) {
      warnings.push(
        `Target org "${org.name}" (${org.org_id}) is protected and usually should not be removed from.`
      );
    }
    if (billingOrgId && billingOrgId === org.org_id) {
      warnings.push(
        `User billing_org_id is "${org.org_id}", the same org you are removing from.`
      );
    }

    if (warnings.length > 0) {
      console.warn(`Warning: ${warnings.join(' ')}`);
      if (!opts.dryRun) {
        const confirmed = opts.confirm
          ? await opts.confirm('Proceed with removal? Type "yes" to continue: ')
          : false;
        if (!confirmed) {
          console.log('Cancelled.');
          return { removed: false };
        }
      }
    }

    if (opts.dryRun) {
      renderDryRun('DELETE', `/v2/enterprise/organizations/${org.org_id}/members/${userId}`);
      return { removed: false };
    }

    await this.membersApi.removeFromOrgs(userId, [org.org_id]);
    return { removed: true };
  }

  // Adds the user to the target org and removes them from all other orgs.
  // Accepts email or user_id — matches on both in the enterprise member list.
  async setOnlyOrg(
    emailOrId: string,
    orgNameOrId: string,
    opts: { dryRun?: boolean } = {}
  ): Promise<void> {
    const targetOrg = await this.orgRegistry.resolve(orgNameOrId);

    const users = await this.membersApi.listEnterpriseMembers();
    const user = users.find((u) => u.user_id === emailOrId || u.email === emailOrId);
    if (!user) throw new Error(`User not found in enterprise members: ${emailOrId}`);

    const userId = user.user_id;
    const currentOrgIds = (user.role_assignments ?? [])
      .filter((r) => r.role.role_type === 'org' && r.org_id)
      .map((r) => r.org_id as string);

    let protectedOrgId: string | null = null;
    try {
      protectedOrgId = (await this.orgRegistry.resolve(PROTECTED_ORG_NAME)).org_id;
    } catch {
      // Protected org isn't in the cache — nothing to protect, proceed normally.
    }

    const orgsToRemove = currentOrgIds.filter(
      (id) => id !== targetOrg.org_id && id !== protectedOrgId
    );
    const needsAdd = !currentOrgIds.includes(targetOrg.org_id);

    console.log(`  User:         ${user.email ?? userId} (${userId})`);
    console.log(`  Current orgs: [${currentOrgIds.join(', ') || 'none'}]`);
    console.log(`  Target org:   ${targetOrg.org_id} (${targetOrg.name})`);
    if (needsAdd) console.log(`  Will add to:  ${targetOrg.org_id}`);
    if (protectedOrgId && currentOrgIds.includes(protectedOrgId) && protectedOrgId !== targetOrg.org_id) {
      console.log(`  Retaining membership in protected org: ${protectedOrgId} (${PROTECTED_ORG_NAME})`);
    }
    if (orgsToRemove.length) console.log(`  Will remove from: [${orgsToRemove.join(', ')}]`);

    if (needsAdd) {
      const addBody = { user_ids: [userId], org_ids: [targetOrg.org_id] };
      if (opts.dryRun) {
        renderDryRun('POST', `/v2/enterprise/organizations/${targetOrg.org_id}/members`, addBody);
      } else {
        await this.membersApi.addToOrgs(targetOrg.org_id, addBody);
      }
    }

    if (orgsToRemove.length > 0) {
      if (opts.dryRun) {
        for (const orgId of orgsToRemove) {
          renderDryRun('DELETE', `/v2/enterprise/organizations/${orgId}/members/${userId}`);
        }
      } else {
        await this.membersApi.removeFromOrgs(userId, orgsToRemove);
      }
    }

    if (opts.dryRun) {
      await this.acuLimitService.setBillingOrg(userId, targetOrg.org_id, true);
      return;
    }

    try {
      await this.acuLimitService.setBillingOrg(userId, targetOrg.org_id, false);
    } catch (err) {
      console.warn(
        `Warning: org membership updated but failed to update billing org: ${(err as Error).message}. ` +
          `Attempting to revert org membership...`
      );
      try {
        if (needsAdd) {
          await this.membersApi.removeFromOrgs(userId, [targetOrg.org_id]);
        }
        if (orgsToRemove.length > 0) {
          await Promise.all(
            orgsToRemove.map((orgId) =>
              this.membersApi.addToOrgs(orgId, { user_ids: [userId], org_ids: [orgId] })
            )
          );
        }
      } catch (revertErr) {
        console.warn(
          `Warning: failed to revert org membership after billing-org update failure: ${
            (revertErr as Error).message
          }. User ${userId} is left in an inconsistent org state and needs manual cleanup.`
        );
        throw err;
      }
      console.warn(
        `Org membership reverted. Once the billing-org issue is resolved, re-run ` +
          `"membership set-only ${emailOrId} --org ${orgNameOrId}" or ` +
          `"membership set-billing-org ${emailOrId} --billing-org ${orgNameOrId}" manually.`
      );
      throw err;
    }
  }
}
