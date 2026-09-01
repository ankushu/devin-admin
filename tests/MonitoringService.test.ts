import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringService } from '../src/services/MonitoringService.js';
import type { ConsumptionApi } from '../src/api/ConsumptionApi.js';
import type { AcuLimitsApi } from '../src/api/AcuLimitsApi.js';
import type { MembersApi } from '../src/api/MembersApi.js';
import type { OrgRegistry } from '../src/orgs/OrgRegistry.js';
import type { UserResolver } from '../src/users/UserResolver.js';
import type { ConsumptionResponse, OrgAcuLimitResponse, UserAcuLimitResponse, User } from '../src/models/types.js';
import { getIsoWeekLabel } from '../src/utils/dates.js';

const ORG = { org_id: 'org-1', name: 'Alpha', created_at: 0, updated_at: 0, max_session_acu_limit: null, max_cycle_acu_limit: null };

const CONSUMPTION: ConsumptionResponse = {
  total_acus: 350,
  consumption_by_date: [
    { date: 1748736000, acus: 100, acus_by_product: { devin: 60, cascade: 40 } },
    { date: 1748822400, acus: 200, acus_by_product: { devin: 120, terminal: 80 } },
    { date: 1748908800, acus: 50, acus_by_product: {} },
  ],
};

function makeConsumptionApi(): ConsumptionApi {
  return {
    getOrgDaily: vi.fn().mockResolvedValue(CONSUMPTION),
    getUserDaily: vi.fn().mockResolvedValue(CONSUMPTION),
  } as unknown as ConsumptionApi;
}

function makeAcuApi(): AcuLimitsApi {
  return {
    getOrg: vi.fn().mockResolvedValue({ cloud_agent: { cycle_acu_limit: 1000 } } as OrgAcuLimitResponse),
    getUser: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 500 } } as UserAcuLimitResponse),
  } as unknown as AcuLimitsApi;
}

function makeZeroCloudAcuApi(): AcuLimitsApi {
  return {
    getOrg: vi.fn().mockResolvedValue({
      cloud_agent: { cycle_acu_limit: 0 },
      local_agent: { cycle_acu_limit: 500 },
    } as OrgAcuLimitResponse),
    getUser: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 500 } } as UserAcuLimitResponse),
  } as unknown as AcuLimitsApi;
}

function makeRegistry(): OrgRegistry {
  return { resolve: vi.fn().mockResolvedValue(ORG) } as unknown as OrgRegistry;
}

function makeUserResolver(resolvedId = 'user-abc'): UserResolver {
  return { resolveId: vi.fn().mockResolvedValue(resolvedId) } as unknown as UserResolver;
}

function makeMembersApi(members: User[] = []): MembersApi {
  return { listOrgMembers: vi.fn().mockResolvedValue(members) } as unknown as MembersApi;
}

describe('MonitoringService', () => {
  let svc: MonitoringService;

  beforeEach(() => {
    svc = new MonitoringService(makeConsumptionApi(), makeAcuApi(), makeRegistry(), makeUserResolver(), makeMembersApi());
  });

  describe('monitorOrg', () => {
    it('calls getOrgDaily with the resolved org_id and correct time range', async () => {
      const api = makeConsumptionApi();
      const svc2 = new MonitoringService(api, makeAcuApi(), makeRegistry(), makeUserResolver(), makeMembersApi());
      await svc2.monitorOrg('Alpha', '2026-06');
      expect(vi.mocked(api.getOrgDaily)).toHaveBeenCalledWith('org-1', {
        time_after: Math.floor(new Date('2026-06-19T08:00:00Z').getTime() / 1000),
        time_before: Math.floor(new Date('2026-07-19T08:00:00Z').getTime() / 1000),
      });
    });

    it('supports explicit start/end date range with inclusive end', async () => {
      const api = makeConsumptionApi();
      const svc2 = new MonitoringService(api, makeAcuApi(), makeRegistry(), makeUserResolver(), makeMembersApi());
      await svc2.monitorOrg('Alpha', { start: '2026-06-10', end: '2026-06-12' });
      expect(vi.mocked(api.getOrgDaily)).toHaveBeenCalledWith('org-1', {
        time_after: Math.floor(new Date('2026-06-10T08:00:00Z').getTime() / 1000),
        time_before: Math.floor(new Date('2026-06-13T08:00:00Z').getTime() / 1000),
      });
    });

    it('sums total ACUs across all days', async () => {
      const result = await svc.monitorOrg('Alpha', '2026-06');
      expect(result.totalAcus).toBe(350); // 100 + 200 + 50
    });

    it('aggregates byProduct across all days', async () => {
      const result = await svc.monitorOrg('Alpha', '2026-06');
      expect(result.byProduct.devin).toBe(180);
      expect(result.byProduct.cascade).toBe(40);
      expect(result.byProduct.terminal).toBe(80);
    });

    it('surfaces both cloud and local limits when the cloud limit is zero', async () => {
      const svc2 = new MonitoringService(
        makeConsumptionApi(),
        makeZeroCloudAcuApi(),
        makeRegistry(),
        makeUserResolver(),
        makeMembersApi()
      );
      const result = await svc2.monitorOrg('Alpha', '2026-06');
      expect(result.cloudLimit).toBe(0);
      expect(result.localLimit).toBe(500);
    });

    it('surfaces org cloud limit', async () => {
      const result = await svc.monitorOrg('Alpha', '2026-06');
      expect(result.cloudLimit).toBe(1000);
    });

    it('includes daily trend rows in the result', async () => {
      const result = await svc.monitorOrg('Alpha', '2026-06');
      expect(result.dailyTrend).toHaveLength(3);
      expect(result.dailyTrend[0]).toEqual({
        date: '2025-06-01',
        acus: 100,
        byProduct: { devin: 60, cascade: 40 },
      });
    });
  });

  describe('monitorAllOrgs', () => {
    it('uses the local limit when the cloud limit is zero', async () => {
      const registry = {
        get: vi.fn().mockResolvedValue([ORG]),
      } as unknown as OrgRegistry;
      const svc2 = new MonitoringService(
        makeConsumptionApi(),
        makeZeroCloudAcuApi(),
        registry,
        makeUserResolver(),
        makeMembersApi()
      );

      const result = await svc2.monitorAllOrgs('2026-06');

      expect(result.orgs).toHaveLength(1);
      expect(result.orgs[0].limit).toBe(500);
    });
  });

  describe('monitorUser', () => {
    it('resolves email to user_id before API calls', async () => {
      const resolver = makeUserResolver('user-abc');
      const consumptionApi = makeConsumptionApi();
      const svc2 = new MonitoringService(consumptionApi, makeAcuApi(), makeRegistry(), resolver, makeMembersApi());
      await svc2.monitorUser('alice@example.com', '2026-06');
      expect(resolver.resolveId).toHaveBeenCalledWith('alice@example.com');
      expect(vi.mocked(consumptionApi.getUserDaily)).toHaveBeenCalledWith('user-abc', expect.any(Object));
    });

    it('supports explicit start/end date range with inclusive end', async () => {
      const consumptionApi = makeConsumptionApi();
      const svc2 = new MonitoringService(consumptionApi, makeAcuApi(), makeRegistry(), makeUserResolver(), makeMembersApi());
      await svc2.monitorUser('alice@example.com', { start: '2026-06-05', end: '2026-06-05' });
      expect(vi.mocked(consumptionApi.getUserDaily)).toHaveBeenCalledWith('user-abc', {
        time_after: Math.floor(new Date('2026-06-05T08:00:00Z').getTime() / 1000),
        time_before: Math.floor(new Date('2026-06-06T08:00:00Z').getTime() / 1000),
      });
    });

    it('returns total_acus from the API response', async () => {
      const result = await svc.monitorUser('alice@example.com', '2026-06');
      expect(result.totalAcus).toBe(350);
    });

    it('aggregates byProduct across all days', async () => {
      const result = await svc.monitorUser('alice@example.com', '2026-06');
      expect(result.byProduct.devin).toBe(180);
      expect(result.byProduct.cascade).toBe(40);
      expect(result.byProduct.terminal).toBe(80);
    });

    it('surfaces user local limit', async () => {
      const result = await svc.monitorUser('alice@example.com', '2026-06');
      expect(result.localLimit).toBe(500);
    });

    it('includes daily trend rows in the result', async () => {
      const result = await svc.monitorUser('alice@example.com', '2026-06');
      expect(result.dailyTrend).toHaveLength(3);
      expect(result.dailyTrend[1]).toEqual({
        date: '2025-06-02',
        acus: 200,
        byProduct: { devin: 120, terminal: 80 },
      });
    });
  });

  describe('monitorActiveUsers', () => {
    const DATES = ['2025-06-01', '2025-06-02', '2025-06-03'];

    function dayResponse(activeDates: string[]): ConsumptionResponse {
      return {
        total_acus: activeDates.length * 10,
        consumption_by_date: CONSUMPTION.consumption_by_date.map((day, i) => ({
          date: day.date,
          acus: activeDates.includes(DATES[i]) ? 10 : 0,
        })),
      };
    }

    function makeMembers(): User[] {
      return [
        { user_id: 'user-1', email: 'u1@example.com', name: 'User One', role_assignments: [] },
        { user_id: 'user-2', email: 'u2@example.com', name: 'User Two', role_assignments: [] },
        { user_id: 'user-3', email: 'u3@example.com', name: 'User Three', role_assignments: [] },
        { user_id: 'user-4', email: 'u4@example.com', name: 'User Four', role_assignments: [] },
      ];
    }

    function makeActiveUsersConsumptionApi(): ConsumptionApi {
      return {
        getUserDaily: vi.fn().mockImplementation((userId: string) => {
          if (userId === 'user-1') return Promise.resolve(dayResponse(DATES));
          if (userId === 'user-2') return Promise.resolve(dayResponse(['2025-06-01']));
          if (userId === 'user-3') return Promise.resolve(dayResponse([]));
          return Promise.reject(new Error('fetch failed'));
        }),
      } as unknown as ConsumptionApi;
    }

    it('resolves the org and lists its members', async () => {
      const registry = makeRegistry();
      const svc2 = new MonitoringService(
        makeActiveUsersConsumptionApi(),
        makeAcuApi(),
        registry,
        makeUserResolver(),
        makeMembersApi(makeMembers())
      );
      await svc2.monitorActiveUsers('Alpha', '2026-06');
      expect(registry.resolve).toHaveBeenCalledWith('Alpha');
    });

    it('counts distinct active users per day and per month, skipping fetch errors', async () => {
      const svc2 = new MonitoringService(
        makeActiveUsersConsumptionApi(),
        makeAcuApi(),
        makeRegistry(),
        makeUserResolver(),
        makeMembersApi(makeMembers())
      );

      const result = await svc2.monitorActiveUsers('Alpha', '2026-06');

      expect(result.totalMembers).toBe(4);
      expect(result.usersSkipped).toBe(1);
      expect(result.overallActiveUsers).toBe(2);
      expect(result.activeUsers.map((u) => u.user_id).sort()).toEqual(['user-1', 'user-2']);
      expect(result.failedUsers).toEqual([{ user_id: 'user-4', email: 'u4@example.com', name: 'User Four' }]);

      expect(result.daily).toEqual([
        { period: '2025-06-01', activeUsers: 2 },
        { period: '2025-06-02', activeUsers: 1 },
        { period: '2025-06-03', activeUsers: 1 },
      ]);

      expect(result.monthly).toEqual([{ period: '2025-06', activeUsers: 2 }]);
    });

    it('groups weekly active users by ISO week', async () => {
      const svc2 = new MonitoringService(
        makeActiveUsersConsumptionApi(),
        makeAcuApi(),
        makeRegistry(),
        makeUserResolver(),
        makeMembersApi(makeMembers())
      );

      const result = await svc2.monitorActiveUsers('Alpha', '2026-06');

      const expectedWeekly = new Map<string, Set<string>>();
      const usersToDates: [string, string[]][] = [
        ['user-1', DATES],
        ['user-2', ['2025-06-01']],
      ];
      for (const [userId, dates] of usersToDates) {
        for (const date of dates) {
          const week = getIsoWeekLabel(date);
          if (!expectedWeekly.has(week)) expectedWeekly.set(week, new Set());
          expectedWeekly.get(week)!.add(userId);
        }
      }
      const expected = Array.from(expectedWeekly.entries())
        .map(([period, users]) => ({ period, activeUsers: users.size }))
        .sort((a, b) => a.period.localeCompare(b.period));

      expect(result.weekly).toEqual(expected);
    });

    it('always includes the ACU-based undercount warning', async () => {
      const svc2 = new MonitoringService(
        makeActiveUsersConsumptionApi(),
        makeAcuApi(),
        makeRegistry(),
        makeUserResolver(),
        makeMembersApi(makeMembers())
      );
      const result = await svc2.monitorActiveUsers('Alpha', '2026-06');
      expect(result.warning).toMatch(/ACU consumption/i);
    });

    it('retries a failed fetch up to 2 times before giving up', async () => {
      const getUserDaily = vi.fn().mockRejectedValue(new Error('boom'));
      const consumptionApi = { getUserDaily } as unknown as ConsumptionApi;
      const svc2 = new MonitoringService(
        consumptionApi,
        makeAcuApi(),
        makeRegistry(),
        makeUserResolver(),
        makeMembersApi([{ user_id: 'user-1', email: 'u1@example.com', name: 'User One', role_assignments: [] }])
      );

      const result = await svc2.monitorActiveUsers('Alpha', '2026-06');

      expect(getUserDaily).toHaveBeenCalledTimes(3); // 1 initial attempt + 2 retries
      expect(result.failedUsers).toEqual([{ user_id: 'user-1', email: 'u1@example.com', name: 'User One' }]);
      expect(result.usersSkipped).toBe(1);
    });

    it('counts a user as active if a retry succeeds after transient failures', async () => {
      const getUserDaily = vi
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(dayResponse(['2025-06-01']));
      const consumptionApi = { getUserDaily } as unknown as ConsumptionApi;
      const svc2 = new MonitoringService(
        consumptionApi,
        makeAcuApi(),
        makeRegistry(),
        makeUserResolver(),
        makeMembersApi([{ user_id: 'user-1', email: 'u1@example.com', name: 'User One', role_assignments: [] }])
      );

      const result = await svc2.monitorActiveUsers('Alpha', '2026-06');

      expect(getUserDaily).toHaveBeenCalledTimes(2);
      expect(result.failedUsers).toEqual([]);
      expect(result.overallActiveUsers).toBe(1);
    });

    it('reports progress once per member fetched', async () => {
      const svc2 = new MonitoringService(
        makeActiveUsersConsumptionApi(),
        makeAcuApi(),
        makeRegistry(),
        makeUserResolver(),
        makeMembersApi(makeMembers())
      );
      const onProgress = vi.fn();
      await svc2.monitorActiveUsers('Alpha', '2026-06', onProgress);
      expect(onProgress).toHaveBeenCalledTimes(4);
      expect(onProgress).toHaveBeenLastCalledWith(4, 4);
    });
  });
});
