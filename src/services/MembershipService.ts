import type { MembersApi } from '../api/MembersApi.js';
import type { OrgRegistry } from '../orgs/OrgRegistry.js';
import type { UserResolver } from '../users/UserResolver.js';
import { renderDryRun } from '../utils/output.js';

export class MembershipService {
  constructor(
    private readonly membersApi: MembersApi,
    private readonly orgRegistry: OrgRegistry,
    private readonly userResolver: UserResolver
  ) {}

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
    const orgsToRemove = currentOrgIds.filter((id) => id !== targetOrg.org_id);
    const needsAdd = !currentOrgIds.includes(targetOrg.org_id);

    console.log(`  User:         ${user.email ?? userId} (${userId})`);
    console.log(`  Current orgs: [${currentOrgIds.join(', ') || 'none'}]`);
    console.log(`  Target org:   ${targetOrg.org_id} (${targetOrg.name})`);
    if (needsAdd) console.log(`  Will add to:  ${targetOrg.org_id}`);
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
        return;
      }
      await this.membersApi.removeFromOrgs(userId, orgsToRemove);
    }
  }
}
