import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrganizationsApi } from '../src/api/OrganizationsApi.js';
import { OrgRegistry } from '../src/orgs/OrgRegistry.js';
import type { Organization } from '../src/models/types.js';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

const ORGS: Organization[] = [
  { org_id: 'org-1', name: 'Alpha', created_at: 0, updated_at: 0, max_session_acu_limit: null, max_cycle_acu_limit: null },
  { org_id: 'org-2', name: 'Beta', created_at: 0, updated_at: 0, max_session_acu_limit: null, max_cycle_acu_limit: null },
];

function makeApi(orgs = ORGS): OrganizationsApi {
  return { list: vi.fn().mockResolvedValue(orgs) } as unknown as OrganizationsApi;
}

describe('OrgRegistry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches from API when cache file is absent', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const api = makeApi();
    const registry = new OrgRegistry(api, './data/orgs.json');
    const orgs = await registry.get();

    expect(api.list).toHaveBeenCalledOnce();
    expect(orgs).toEqual(ORGS);
  });

  it('reads from disk cache when file exists', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(ORGS) as unknown as Buffer);

    const api = makeApi();
    const registry = new OrgRegistry(api, './data/orgs.json');
    const orgs = await registry.get();

    expect(api.list).not.toHaveBeenCalled();
    expect(orgs).toEqual(ORGS);
  });

  it('bypasses cache on refresh()', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const api = makeApi();
    const registry = new OrgRegistry(api, './data/orgs.json');
    await registry.refresh();

    expect(api.list).toHaveBeenCalledOnce();
    expect(fs.writeFile).toHaveBeenCalledOnce();
  });

  it('resolves org by name', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(ORGS) as unknown as Buffer);
    const registry = new OrgRegistry(makeApi(), './data/orgs.json');
    const org = await registry.resolve('Alpha');
    expect(org).toEqual(ORGS[0]);
  });

  it('resolves org by id', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(ORGS) as unknown as Buffer);
    const registry = new OrgRegistry(makeApi(), './data/orgs.json');
    const org = await registry.resolve('org-2');
    expect(org).toEqual(ORGS[1]);
  });

  it('throws when org is not found', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(ORGS) as unknown as Buffer);
    const registry = new OrgRegistry(makeApi(), './data/orgs.json');
    await expect(registry.resolve('Unknown')).rejects.toThrow('not found');
  });
});
