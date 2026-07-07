import type { AcuLimitsApi } from '../api/AcuLimitsApi.js';
import type { OrgRegistry } from '../orgs/OrgRegistry.js';
import type { UserResolver } from '../users/UserResolver.js';
import type { OrgAcuLimitResponse, UserAcuLimitResponse } from '../models/types.js';
import { renderDryRun } from '../utils/output.js';

export class AcuLimitService {
  constructor(
    private readonly acuLimitsApi: AcuLimitsApi,
    private readonly orgRegistry: OrgRegistry,
    private readonly userResolver: UserResolver
  ) {}

  async getOrg(nameOrId: string): Promise<OrgAcuLimitResponse> {
    const org = await this.orgRegistry.resolve(nameOrId);
    return this.acuLimitsApi.getOrg(org.org_id);
  }

  async setOrg(
    nameOrId: string,
    limits: { local?: number; cloud?: number },
    dryRun = false
  ): Promise<OrgAcuLimitResponse | null> {
    const org = await this.orgRegistry.resolve(nameOrId);
    const body: Record<string, unknown> = {};
    if (limits.local !== undefined) body.local_agent = { cycle_acu_limit: limits.local };
    if (limits.cloud !== undefined) body.cloud_agent = { cycle_acu_limit: limits.cloud };

    if (dryRun) {
      renderDryRun('PATCH', `/v3beta1/enterprise/organizations/${org.org_id}/consumption/acu-limits`, body);
      return null;
    }
    return this.acuLimitsApi.setOrg(org.org_id, body);
  }

  async clearOrg(nameOrId: string, dryRun = false): Promise<void> {
    const org = await this.orgRegistry.resolve(nameOrId);
    if (dryRun) {
      renderDryRun('DELETE', `/v3beta1/enterprise/organizations/${org.org_id}/consumption/acu-limits`);
      return;
    }
    await this.acuLimitsApi.clearOrg(org.org_id);
  }

  async getUser(emailOrId: string): Promise<UserAcuLimitResponse> {
    const userId = await this.userResolver.resolveId(emailOrId);
    return this.acuLimitsApi.getUser(userId);
  }

  async setUser(
    emailOrId: string,
    limits: { local: number; billingOrg?: string },
    dryRun = false
  ): Promise<UserAcuLimitResponse | null> {
    const userId = await this.userResolver.resolveId(emailOrId);

    let billingOrgId = limits.billingOrg;
    if (billingOrgId) {
      const org = await this.orgRegistry.resolve(billingOrgId);
      billingOrgId = org.org_id;
    }

    const body = {
      local_agent: {
        cycle_acu_limit: limits.local,
        ...(billingOrgId ? { billing_org_id: billingOrgId } : {}),
      },
    };

    if (dryRun) {
      renderDryRun('PATCH', `/v3beta1/enterprise/users/${userId}/consumption/acu-limits`, body);
      return null;
    }
    return this.acuLimitsApi.setUser(userId, body);
  }

  async setBillingOrg(
    emailOrId: string,
    billingOrgNameOrId: string,
    dryRun = false
  ): Promise<UserAcuLimitResponse | null> {
    const userId = await this.userResolver.resolveId(emailOrId);
    const org = await this.orgRegistry.resolve(billingOrgNameOrId);
    const body = { local_agent: { billing_org_id: org.org_id } };
    if (dryRun) {
      renderDryRun('PATCH', `/v3beta1/enterprise/users/${userId}/consumption/acu-limits`, body);
      return null;
    }
    return this.acuLimitsApi.setUser(userId, body);
  }

  async clearUser(emailOrId: string, dryRun = false): Promise<void> {
    const userId = await this.userResolver.resolveId(emailOrId);
    if (dryRun) {
      renderDryRun('DELETE', `/v3beta1/enterprise/users/${userId}/consumption/acu-limits`);
      return;
    }
    await this.acuLimitsApi.clearUser(userId);
  }

  getDefault(): Promise<UserAcuLimitResponse> {
    return this.acuLimitsApi.getDefault();
  }

  async setDefault(local: number, dryRun = false): Promise<UserAcuLimitResponse | null> {
    const body = { local_agent: { cycle_acu_limit: local } };
    if (dryRun) {
      renderDryRun('PATCH', '/v3beta1/enterprise/users/consumption/acu-limits', body);
      return null;
    }
    return this.acuLimitsApi.setDefault(body);
  }
}
