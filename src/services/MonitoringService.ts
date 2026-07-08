import type { ConsumptionApi } from '../api/ConsumptionApi.js';
import type { AcuLimitsApi } from '../api/AcuLimitsApi.js';
import type { OrgRegistry } from '../orgs/OrgRegistry.js';
import type { UserResolver } from '../users/UserResolver.js';
import type { TimeRange } from '../api/ConsumptionApi.js';
import type { AcusByProduct, ConsumptionDay, OrgAcuLimitResponse, UserAcuLimitResponse } from '../models/types.js';
import { dateRangeToTimeRange, monthToTimeRange } from '../utils/dates.js';

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
  dailyTrend: DailyTrendRow[];
}

export interface UserMonitorResult {
  userId: string;
  month: string;
  totalAcus: number;
  localLimit: number | undefined;
  byProduct: AcusByProduct;
  dailyTrend: DailyTrendRow[];
}

export interface DailyTrendRow {
  date: string;
  acus: number;
  byProduct: AcusByProduct;
}

export type MonitorPeriodInput = string | { month: string } | { start: string; end: string };

export class MonitoringService {
  constructor(
    private readonly consumptionApi: ConsumptionApi,
    private readonly acuLimitsApi: AcuLimitsApi,
    private readonly orgRegistry: OrgRegistry,
    private readonly userResolver: UserResolver
  ) {}

  async monitorOrg(nameOrId: string, period: MonitorPeriodInput): Promise<OrgMonitorResult> {
    const org = await this.orgRegistry.resolve(nameOrId);
    const { range, month } = resolvePeriod(period);

    const [limit, consumption] = await Promise.all([
      this.acuLimitsApi.getOrg(org.org_id).catch(() => ({} as OrgAcuLimitResponse)),
      this.consumptionApi.getOrgDaily(org.org_id, range),
    ]);

    const { total, byProduct } = aggregate(consumption.consumption_by_date);
    const dailyTrend = toDailyTrend(consumption.consumption_by_date);

    return {
      orgId: org.org_id,
      orgName: org.name,
      month,
      totalAcus: total,
      cloudLimit: limit.cloud_agent?.cycle_acu_limit,
      localLimit: limit.local_agent?.cycle_acu_limit,
      byProduct,
      dailyTrend,
    };
  }

  async monitorUser(emailOrId: string, period: MonitorPeriodInput): Promise<UserMonitorResult> {
    const userId = await this.userResolver.resolveId(emailOrId);
    const { range, month } = resolvePeriod(period);

    const [limit, consumption] = await Promise.all([
      this.acuLimitsApi.getUser(userId).catch(() => ({} as UserAcuLimitResponse)),
      this.consumptionApi.getUserDaily(userId, range),
    ]);

    const { byProduct } = aggregate(consumption.consumption_by_date);
    const dailyTrend = toDailyTrend(consumption.consumption_by_date);

    return {
      userId,
      month,
      totalAcus: consumption.total_acus,
      localLimit: limit.local_agent?.cycle_acu_limit,
      byProduct,
      dailyTrend,
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

function toDailyTrend(days: ConsumptionDay[]): DailyTrendRow[] {
  return days
    .map((day) => ({
      date: new Date(day.date * 1000).toISOString().slice(0, 10),
      acus: day.acus,
      byProduct: day.acus_by_product ?? {},
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function resolvePeriod(period: MonitorPeriodInput): { range: TimeRange; month: string } {
  if (typeof period === 'string') {
    return { range: monthToTimeRange(period), month: period };
  }
  if ('month' in period) {
    return { range: monthToTimeRange(period.month), month: period.month };
  }
  return {
    range: dateRangeToTimeRange(period.start, period.end),
    month: `${period.start}..${period.end}`,
  };
}
