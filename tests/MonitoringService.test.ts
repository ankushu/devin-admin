import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitoringService } from '../src/services/MonitoringService.js';
import type { ConsumptionApi } from '../src/api/ConsumptionApi.js';
import type { AcuLimitsApi } from '../src/api/AcuLimitsApi.js';
import type { OrgRegistry } from '../src/orgs/OrgRegistry.js';
import type { UserResolver } from '../src/users/UserResolver.js';
import type { ConsumptionResponse, OrgAcuLimitResponse, UserAcuLimitResponse } from '../src/models/types.js';

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

function makeRegistry(): OrgRegistry {
  return { resolve: vi.fn().mockResolvedValue(ORG) } as unknown as OrgRegistry;
}

function makeUserResolver(resolvedId = 'user-abc'): UserResolver {
  return { resolveId: vi.fn().mockResolvedValue(resolvedId) } as unknown as UserResolver;
}

describe('MonitoringService', () => {
  let svc: MonitoringService;

  beforeEach(() => {
    svc = new MonitoringService(makeConsumptionApi(), makeAcuApi(), makeRegistry(), makeUserResolver());
  });

  describe('monitorOrg', () => {
    it('calls getOrgDaily with the resolved org_id and correct time range', async () => {
      const api = makeConsumptionApi();
      const svc2 = new MonitoringService(api, makeAcuApi(), makeRegistry(), makeUserResolver());
      await svc2.monitorOrg('Alpha', '2026-06');
      expect(vi.mocked(api.getOrgDaily)).toHaveBeenCalledWith('org-1', {
        time_after: Math.floor(new Date('2026-06-01T08:00:00Z').getTime() / 1000),
        time_before: Math.floor(new Date('2026-07-01T08:00:00Z').getTime() / 1000),
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

    it('surfaces org cloud limit', async () => {
      const result = await svc.monitorOrg('Alpha', '2026-06');
      expect(result.cloudLimit).toBe(1000);
    });
  });

  describe('monitorUser', () => {
    it('resolves email to user_id before API calls', async () => {
      const resolver = makeUserResolver('user-abc');
      const consumptionApi = makeConsumptionApi();
      const svc2 = new MonitoringService(consumptionApi, makeAcuApi(), makeRegistry(), resolver);
      await svc2.monitorUser('alice@example.com', '2026-06');
      expect(resolver.resolveId).toHaveBeenCalledWith('alice@example.com');
      expect(vi.mocked(consumptionApi.getUserDaily)).toHaveBeenCalledWith('user-abc', expect.any(Object));
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
  });
});
