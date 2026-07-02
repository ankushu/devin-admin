import type { ConsumptionApi } from '../api/ConsumptionApi.js';
import type { AcuLimitsApi } from '../api/AcuLimitsApi.js';
import type { OrgRegistry } from '../orgs/OrgRegistry.js';
import type { UserResolver } from '../users/UserResolver.js';
import type { AcusByProduct, ConsumptionDay, OrgAcuLimitResponse, UserAcuLimitResponse } from '../models/types.js';
import { monthToTimeRange } from '../utils/dates.js';

export enum ConsumptionDimension {
  ByProduct = 'by_product',
}

export interface OrgMonitorResult {
  orgId: string;
  orgName: string;
  month: string;
  totalAcus: number;
  cloudLimit: number | undefined;
  localLimit: number | undefined;
  byProduct: AcusByProduct;
}

export interface UserMonitorResult {
  userId: string;
  month: string;
  totalAcus: number;
  localLimit: number | undefined;
  byProduct: AcusByProduct;
}

export class MonitoringService {
  constructor(
    private readonly consumptionApi: ConsumptionApi,
    private readonly acuLimitsApi: AcuLimitsApi,
    private readonly orgRegistry: OrgRegistry,
    private readonly userResolver: UserResolver
  ) {}

  async monitorOrg(nameOrId: string, month: string): Promise<OrgMonitorResult> {
    const org = await this.orgRegistry.resolve(nameOrId);
    const range = monthToTimeRange(month);

    const [limit, consumption] = await Promise.all([
      this.acuLimitsApi.getOrg(org.org_id).catch(() => ({} as OrgAcuLimitResponse)),
      this.consumptionApi.getOrgDaily(org.org_id, range),
    ]);

    const { total, byProduct } = aggregate(consumption.consumption_by_date);

    return {
      orgId: org.org_id,
      orgName: org.name,
      month,
      totalAcus: total,
      cloudLimit: limit.cloud_agent?.cycle_acu_limit,
      localLimit: limit.local_agent?.cycle_acu_limit,
      byProduct,
    };
  }

  async monitorUser(emailOrId: string, month: string): Promise<UserMonitorResult> {
    const userId = await this.userResolver.resolveId(emailOrId);
    const range = monthToTimeRange(month);

    const [limit, consumption] = await Promise.all([
      this.acuLimitsApi.getUser(userId).catch(() => ({} as UserAcuLimitResponse)),
      this.consumptionApi.getUserDaily(userId, range),
    ]);

    const { byProduct } = aggregate(consumption.consumption_by_date);

    return {
      userId,
      month,
      totalAcus: consumption.total_acus,
      localLimit: limit.local_agent?.cycle_acu_limit,
      byProduct,
    };
  }
}

function aggregate(days: ConsumptionDay[]): { total: number; byProduct: AcusByProduct } {
  let total = 0;
  const byProduct: AcusByProduct = {};

  for (const day of days) {
    total += day.acus;
    if (day.acus_by_product) {
      for (const [k, v] of Object.entries(day.acus_by_product)) {
        if (v != null) byProduct[k] = (byProduct[k] ?? 0) + v;
      }
    }
  }

  return { total, byProduct };
}

export function pctUsed(used: number, limit: number | undefined): string {
  if (limit === undefined || limit === 0) return 'N/A';
  return `${((used / limit) * 100).toFixed(1)}%`;
}
