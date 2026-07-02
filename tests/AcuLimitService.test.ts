import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcuLimitService } from '../src/services/AcuLimitService.js';
import type { AcuLimitsApi } from '../src/api/AcuLimitsApi.js';
import type { OrgRegistry } from '../src/orgs/OrgRegistry.js';
import type { UserResolver } from '../src/users/UserResolver.js';
import type { OrgAcuLimitResponse, UserAcuLimitResponse } from '../src/models/types.js';

const ORG = { org_id: 'org-123', name: 'Acme', created_at: 0, updated_at: 0, max_session_acu_limit: null, max_cycle_acu_limit: null };

function makeAcuApi(): AcuLimitsApi {
  return {
    getOrg: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 500 } } as OrgAcuLimitResponse),
    setOrg: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 300 } } as OrgAcuLimitResponse),
    clearOrg: vi.fn().mockResolvedValue(undefined),
    getUser: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 100 } } as UserAcuLimitResponse),
    setUser: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 200 } } as UserAcuLimitResponse),
    clearUser: vi.fn().mockResolvedValue(undefined),
    getDefault: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 50 } } as UserAcuLimitResponse),
    setDefault: vi.fn().mockResolvedValue({ local_agent: { cycle_acu_limit: 75 } } as UserAcuLimitResponse),
  } as unknown as AcuLimitsApi;
}

function makeRegistry(): OrgRegistry {
  return { resolve: vi.fn().mockResolvedValue(ORG) } as unknown as OrgRegistry;
}

function makeUserResolver(resolvedId = 'user-abc'): UserResolver {
  return { resolveId: vi.fn().mockResolvedValue(resolvedId) } as unknown as UserResolver;
}

describe('AcuLimitService', () => {
  let api: AcuLimitsApi;
  let registry: OrgRegistry;
  let resolver: UserResolver;
  let svc: AcuLimitService;

  beforeEach(() => {
    api = makeAcuApi();
    registry = makeRegistry();
    resolver = makeUserResolver();
    svc = new AcuLimitService(api, registry, resolver);
  });

  it('getOrg resolves org then calls acuLimitsApi.getOrg', async () => {
    await svc.getOrg('Acme');
    expect(registry.resolve).toHaveBeenCalledWith('Acme');
    expect(api.getOrg).toHaveBeenCalledWith('org-123');
  });

  it('setOrg builds correct body with local and cloud', async () => {
    await svc.setOrg('Acme', { local: 300, cloud: 600 });
    expect(api.setOrg).toHaveBeenCalledWith('org-123', {
      local_agent: { cycle_acu_limit: 300 },
      cloud_agent: { cycle_acu_limit: 600 },
    });
  });

  it('setOrg omits cloud_agent when not provided', async () => {
    await svc.setOrg('Acme', { local: 100 });
    const body = vi.mocked(api.setOrg).mock.calls[0][1];
    expect(body).not.toHaveProperty('cloud_agent');
  });

  it('setOrg does not call API in dry-run mode', async () => {
    const result = await svc.setOrg('Acme', { local: 100 }, true);
    expect(api.setOrg).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('clearOrg does not call API in dry-run mode', async () => {
    await svc.clearOrg('Acme', true);
    expect(api.clearOrg).not.toHaveBeenCalled();
  });

  it('getUser resolves email to user_id before API call', async () => {
    await svc.getUser('alice@example.com');
    expect(resolver.resolveId).toHaveBeenCalledWith('alice@example.com');
    expect(api.getUser).toHaveBeenCalledWith('user-abc');
  });

  it('setUser builds correct body with billing org', async () => {
    await svc.setUser('alice@example.com', { local: 200, billingOrg: 'Acme' });
    expect(api.setUser).toHaveBeenCalledWith('user-abc', {
      local_agent: { cycle_acu_limit: 200, billing_org_id: 'org-123' },
    });
  });

  it('setUser omits billing_org_id when not provided', async () => {
    await svc.setUser('alice@example.com', { local: 150 });
    const body = vi.mocked(api.setUser).mock.calls[0][1];
    expect(body.local_agent).not.toHaveProperty('billing_org_id');
  });

  it('setDefault builds correct body', async () => {
    await svc.setDefault(75);
    expect(api.setDefault).toHaveBeenCalledWith({ local_agent: { cycle_acu_limit: 75 } });
  });
});
