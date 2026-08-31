import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserResolver } from '../src/users/UserResolver.js';
import type { MembersApi } from '../src/api/MembersApi.js';
import type { User } from '../src/models/types.js';

function makeUser(user_id: string): User {
  return { user_id, email: null, name: null, role_assignments: [] };
}

function makeMembersApi(): MembersApi {
  return { listEnterpriseMembers: vi.fn().mockResolvedValue([makeUser('user-abc')]) } as unknown as MembersApi;
}

describe('UserResolver', () => {
  let membersApi: MembersApi;

  beforeEach(() => {
    membersApi = makeMembersApi();
  });

  it('passes a user-… id through untouched, without a network call', async () => {
    const resolver = new UserResolver(membersApi, 'servicenow.com');
    const id = await resolver.resolveId('user-xyz');
    expect(id).toBe('user-xyz');
    expect(membersApi.listEnterpriseMembers).not.toHaveBeenCalled();
  });

  it('passes an email|… id through untouched too (ids aren\'t all one prefix)', async () => {
    const resolver = new UserResolver(membersApi, 'servicenow.com');
    const id = await resolver.resolveId('email|69846cd92a96a7c11b75e55b');
    expect(id).toBe('email|69846cd92a96a7c11b75e55b');
    expect(membersApi.listEnterpriseMembers).not.toHaveBeenCalled();
  });

  it('looks up an email as-is', async () => {
    const resolver = new UserResolver(membersApi, 'servicenow.com');
    const id = await resolver.resolveId('ankush.agrawal@servicenow.com');
    expect(id).toBe('user-abc');
    expect(membersApi.listEnterpriseMembers).toHaveBeenCalledWith('ankush.agrawal@servicenow.com');
  });

  it('converts a full name to a dotted email using USER_EMAIL_DOMAIN', async () => {
    const resolver = new UserResolver(membersApi, 'servicenow.com');
    const id = await resolver.resolveId('Ankush Agrawal');
    expect(id).toBe('user-abc');
    expect(membersApi.listEnterpriseMembers).toHaveBeenCalledWith('ankush.agrawal@servicenow.com');
  });

  it('normalizes extra whitespace and mixed case in a name', async () => {
    const resolver = new UserResolver(membersApi, 'servicenow.com');
    await resolver.resolveId('  Ankush   Agrawal  ');
    expect(membersApi.listEnterpriseMembers).toHaveBeenCalledWith('ankush.agrawal@servicenow.com');
  });

  it('throws a clear error when a name is given but no domain is configured', async () => {
    const resolver = new UserResolver(membersApi);
    await expect(resolver.resolveId('Ankush Agrawal')).rejects.toThrow(/USER_EMAIL_DOMAIN/);
  });

  it('throws when no user matches the resolved email', async () => {
    vi.mocked(membersApi.listEnterpriseMembers).mockResolvedValue([]);
    const resolver = new UserResolver(membersApi, 'servicenow.com');
    await expect(resolver.resolveId('nobody@servicenow.com')).rejects.toThrow(/No user found/);
  });

  describe('toEmail', () => {
    it('converts a name without resolving it (no network call)', () => {
      const resolver = new UserResolver(membersApi, 'servicenow.com');
      expect(resolver.toEmail('Ankush Agrawal')).toBe('ankush.agrawal@servicenow.com');
      expect(membersApi.listEnterpriseMembers).not.toHaveBeenCalled();
    });

    it('throws a clear error when no domain is configured', () => {
      const resolver = new UserResolver(membersApi);
      expect(() => resolver.toEmail('Ankush Agrawal')).toThrow(/USER_EMAIL_DOMAIN/);
    });
  });
});
