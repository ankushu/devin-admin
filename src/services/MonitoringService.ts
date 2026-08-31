import type { ConsumptionApi } from '../api/ConsumptionApi.js';
import type { AcuLimitsApi } from '../api/AcuLimitsApi.js';
import type { MembersApi } from '../api/MembersApi.js';
import type { OrgRegistry } from '../orgs/OrgRegistry.js';
import type { UserResolver } from '../users/UserResolver.js';
import type { TimeRange } from '../api/ConsumptionApi.js';
import type { AcusByProduct, ConsumptionDay, OrgAcuLimitResponse, UserAcuLimitResponse } from '../models/types.js';
import { dateRangeToTimeRange, monthToTimeRange, getCycleForDate, getIsoWeekLabel } from '../utils/dates.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { withRetries } from '../utils/retry.js';

const ACTIVE_USERS_WARNING =
  'Active users are inferred from ACU consumption only (no bulk active-users or per-tool ' +
  '[Desktop/CLI/Cloud] API exists). Users who exclusively use non-premium/free models that ' +
  "don't consume ACUs will not be counted, so these figures may undercount true active users. " +
  'Users whose consumption fetch still failed after retries are excluded and listed under ' +
  '"failedUsers" for manual follow-up.';

const ACTIVE_USERS_CONCURRENCY = 8;
const ACTIVE_USERS_FETCH_RETRIES = 2;
const ACTIVE_USERS_RETRY_DELAY_MS = 200;

export enum ConsumptionDimension {
  ByProduct = 'by_product',
}

export interface CycleConsumption {
  cycleId: string;
  totalAcus: number;
}

export interface OrgMonitorResult {
  orgId: string;
  orgName: string;
  month: string;
  isPartialCycle: boolean;
  totalAcus: number;
  cloudLimit: number | undefined;
  localLimit: number | undefined;
  cycles: CycleConsumption[];
  byProduct: AcusByProduct;
  dailyTrend: DailyTrendRow[];
}

export interface AllOrgsMonitorResult {
  month: string;
  orgs: OrgSummary[];
}

export interface OrgSummary {
  orgId: string;
  orgName: string;
  totalAcus: number;
  limit: number | undefined;
  byProduct: AcusByProduct;
}

export interface UserMonitorResult {
  userId: string;
  month: string;
  isPartialCycle: boolean;
  totalAcus: number;
  localLimit: number | undefined;
  billingOrgId: string | undefined;
  cycles: CycleConsumption[];
  byProduct: AcusByProduct;
  dailyTrend: DailyTrendRow[];
}

export interface DailyTrendRow {
  date: string;
  acus: number;
  byProduct: AcusByProduct;
}

export interface ActiveUserCount {
  period: string;
  activeUsers: number;
}

export interface ActiveUserSummary {
  user_id: string;
  email: string | null;
  name: string | null;
}

export interface ActiveUsersResult {
  orgId: string;
  orgName: string;
  month: string;
  isPartialCycle: boolean;
  totalMembers: number;
  usersSkipped: number;
  overallActiveUsers: number;
  activeUsers: ActiveUserSummary[];
  failedUsers: ActiveUserSummary[];
  daily: ActiveUserCount[];
  weekly: ActiveUserCount[];
  monthly: ActiveUserCount[];
  warning: string;
}

export type MonitorPeriodInput = string | { month: string } | { start: string; end: string };

export class MonitoringService {
  constructor(
    private readonly consumptionApi: ConsumptionApi,
    private readonly acuLimitsApi: AcuLimitsApi,
    private readonly orgRegistry: OrgRegistry,
    private readonly userResolver: UserResolver,
    private readonly membersApi: MembersApi
  ) {}

  async monitorOrg(nameOrId: string, period: MonitorPeriodInput): Promise<OrgMonitorResult> {
    const org = await this.orgRegistry.resolve(nameOrId);
    const { range, month, isPartialCycle } = resolvePeriod(period);

    const [limit, consumption] = await Promise.all([
      this.acuLimitsApi.getOrg(org.org_id).catch(() => ({} as OrgAcuLimitResponse)),
      this.consumptionApi.getOrgDaily(org.org_id, range),
    ]);

    const { total, byProduct, cycles } = aggregate(consumption.consumption_by_date);
    const dailyTrend = toDailyTrend(consumption.consumption_by_date);

    return {
      orgId: org.org_id,
      orgName: org.name,
      month,
      isPartialCycle,
      totalAcus: total,
      cloudLimit: limit.cloud_agent?.cycle_acu_limit,
      localLimit: limit.local_agent?.cycle_acu_limit,
      cycles,
      byProduct,
      dailyTrend,
    };
  }

  async monitorUser(emailOrId: string, period: MonitorPeriodInput): Promise<UserMonitorResult> {
    const userId = await this.userResolver.resolveId(emailOrId);
    const { range, month, isPartialCycle } = resolvePeriod(period);

    const [limit, consumption] = await Promise.all([
      this.acuLimitsApi.getUser(userId).catch(() => ({} as UserAcuLimitResponse)),
      this.consumptionApi.getUserDaily(userId, range),
    ]);

    const { byProduct, cycles } = aggregate(consumption.consumption_by_date);
    const dailyTrend = toDailyTrend(consumption.consumption_by_date);

    return {
      userId,
      month,
      isPartialCycle,
      totalAcus: consumption.total_acus,
      localLimit: limit.local_agent?.cycle_acu_limit,
      billingOrgId: limit.local_agent?.billing_org_id,
      cycles,
      byProduct,
      dailyTrend,
    };
  }

  async monitorAllOrgs(period: MonitorPeriodInput): Promise<AllOrgsMonitorResult> {
    const { range, month } = resolvePeriod(period);
    const orgs = await this.orgRegistry.get();

    const orgSummaries: OrgSummary[] = (
      await Promise.all(
        orgs.map(async (org) => {
          try {
            const [limit, consumption] = await Promise.all([
              this.acuLimitsApi.getOrg(org.org_id).catch(() => ({} as OrgAcuLimitResponse)),
              this.consumptionApi.getOrgDaily(org.org_id, range),
            ]);

            const { total, byProduct } = aggregate(consumption.consumption_by_date);
            const effectiveLimit = limit.cloud_agent?.cycle_acu_limit ?? limit.local_agent?.cycle_acu_limit;

            return {
              orgId: org.org_id,
              orgName: org.name,
              totalAcus: total,
              limit: effectiveLimit,
              byProduct,
            };
          } catch (error) {
            // Skip orgs that don't have consumption data (404 or other errors)
            return null;
          }
        })
      )
    ).filter((org): org is OrgSummary => org !== null);

    return {
      month,
      orgs: orgSummaries.sort((a, b) => b.totalAcus - a.totalAcus),
    };
  }

  // Derives DAU/WAU/MAU for an org from per-user ACU consumption, since the
  // Devin API has no bulk active-users or per-tool (Desktop/CLI/Cloud)
  // endpoint — see ACTIVE_USERS_WARNING.
  async monitorActiveUsers(
    nameOrId: string,
    period: MonitorPeriodInput,
    onProgress?: (done: number, total: number) => void
  ): Promise<ActiveUsersResult> {
    const org = await this.orgRegistry.resolve(nameOrId);
    const { range, month, isPartialCycle } = resolvePeriod(period);
    const members = await this.membersApi.listOrgMembers(org.org_id);

    const results = await mapWithConcurrency(
      members,
      ACTIVE_USERS_CONCURRENCY,
      (member) =>
        withRetries(
          () => this.consumptionApi.getUserDaily(member.user_id, range),
          ACTIVE_USERS_FETCH_RETRIES,
          ACTIVE_USERS_RETRY_DELAY_MS
        ),
      onProgress
    );

    const activeDatesByUser = new Map<string, Set<string>>();
    const failedUsers: ActiveUserSummary[] = [];

    results.forEach((result, index) => {
      const member = members[index];
      if (result.status === 'rejected') {
        failedUsers.push({ user_id: member.user_id, email: member.email, name: member.name });
        return;
      }
      const activeDates = new Set<string>();
      for (const day of result.value.consumption_by_date) {
        if (day.acus > 0) activeDates.add(new Date(day.date * 1000).toISOString().slice(0, 10));
      }
      if (activeDates.size > 0) activeDatesByUser.set(member.user_id, activeDates);
    });

    const daily = countUsersByPeriod(activeDatesByUser, (date) => date);
    const weekly = countUsersByPeriod(activeDatesByUser, getIsoWeekLabel);
    const monthly = countUsersByPeriod(activeDatesByUser, (date) => date.slice(0, 7));

    const activeUsers: ActiveUserSummary[] = members
      .filter((m) => activeDatesByUser.has(m.user_id))
      .map((m) => ({ user_id: m.user_id, email: m.email, name: m.name }));

    return {
      orgId: org.org_id,
      orgName: org.name,
      month,
      isPartialCycle,
      totalMembers: members.length,
      usersSkipped: failedUsers.length,
      overallActiveUsers: activeUsers.length,
      activeUsers,
      failedUsers,
      daily,
      weekly,
      monthly,
      warning: ACTIVE_USERS_WARNING,
    };
  }
}

// Groups each user's active dates by a period key (day/ISO-week/month) and
// counts the distinct users active in each period.
function countUsersByPeriod(
  activeDatesByUser: Map<string, Set<string>>,
  keyFor: (date: string) => string
): ActiveUserCount[] {
  const usersByPeriod = new Map<string, Set<string>>();

  for (const [userId, dates] of activeDatesByUser) {
    for (const date of dates) {
      const key = keyFor(date);
      let bucket = usersByPeriod.get(key);
      if (!bucket) {
        bucket = new Set<string>();
        usersByPeriod.set(key, bucket);
      }
      bucket.add(userId);
    }
  }

  return Array.from(usersByPeriod.entries())
    .map(([period, users]) => ({ period, activeUsers: users.size }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function aggregate(days: ConsumptionDay[]): { total: number; byProduct: AcusByProduct; cycles: CycleConsumption[] } {
  let total = 0;
  const byProduct: AcusByProduct = {};
  const cycleTotals: Record<string, number> = {};

  for (const day of days) {
    total += day.acus;
    const dateStr = new Date(day.date * 1000).toISOString().slice(0, 10);
    const cycleId = getCycleForDate(dateStr);
    cycleTotals[cycleId] = (cycleTotals[cycleId] ?? 0) + day.acus;

    if (day.acus_by_product) {
      for (const [k, v] of Object.entries(day.acus_by_product)) {
        if (v != null) byProduct[k] = (byProduct[k] ?? 0) + v;
      }
    }
  }

  const cycles = Object.entries(cycleTotals)
    .map(([cycleId, totalAcus]) => ({ cycleId, totalAcus }))
    .sort((a, b) => a.cycleId.localeCompare(b.cycleId));

  return { total, byProduct, cycles };
}

export function pctUsed(used: number, limit: number | undefined): string {
  if (limit === undefined || limit === 0) return 'N/A';
  return `${((used / limit) * 100).toFixed(2)}%`;
}

export function pctOfTotal(value: number | null | undefined, total: number): string {
  if (value == null || total === 0) return '0.00%';
  return `${((value / total) * 100).toFixed(2)}%`;
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

function resolvePeriod(period: MonitorPeriodInput): { range: TimeRange; month: string; isPartialCycle: boolean } {
  if (typeof period === 'string') {
    return { range: monthToTimeRange(period), month: period, isPartialCycle: false };
  }
  if ('month' in period) {
    return { range: monthToTimeRange(period.month), month: period.month, isPartialCycle: false };
  }
  return {
    range: dateRangeToTimeRange(period.start, period.end),
    month: `${period.start}..${period.end}`,
    isPartialCycle: true,
  };
}
