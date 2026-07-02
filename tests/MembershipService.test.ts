import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from '../src/services/MembershipService.js';
import type { MembersApi } from '../src/api/MembersApi.js';
import type { OrgRegistry } from '../src/orgs/OrgRegistry.js';
import type { UserResolver } from '../src/users/UserResolver.js';
import type { User } from '../src/models/types.js';

const TARGET_ORG = { org_id: 'org-target', name: 'Target', created_at: 0, updated_at: 0, max_session_acu_limit: null, max_cycle_acu_limit: null };
const OTHER_ORG_ID = 'org-other';

const USER: User = {
  user_id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  role_assignments: [
    { role: { role_id: 'r1', role_name: 'member', role_type: 'org' }, org_id: OTHER_ORG_ID },
  ],
};

function makeMembersApi(user = USER): MembersApi {
  return {
    listEnterpriseMembers: vi.fn().mockResolvedValue([user]),
    addToOrgs: vi.fn().mockResolvedValue(undefined),
    removeFromOrgs: vi.fn().mockResolvedValue(undefined),
  } as unknown as MembersApi;
}

function makeRegistry(): OrgRegistry {
  return { resolve: vi.fn().mockResolvedValue(TARGET_ORG) } as unknown as OrgRegistry;
}

function makeUserResolver(resolvedId = 'user-1'): UserResolver {
  return { resolveId: vi.fn().mockResolvedValue(resolvedId) } as unknown as UserResolver;
}

describe('MembershipService', () => {
  let api: MembersApi;
  let svc: MembershipService;

  beforeEach(() => {
    api = makeMembersApi();
    svc = new MembershipService(api, makeRegistry(), makeUserResolver());
  });

  describe('assignOrg', () => {
    it('resolves email to user_id before calling addToOrgs', async () => {
      const resolver = makeUserResolver('user-1');
      const svc2 = new MembershipService(api, makeRegistry(), resolver);
      await svc2.assignOrg('alice@example.com', 'Target');
      expect(resolver.resolveId).toHaveBeenCalledWith('alice@example.com');
      expect(api.addToOrgs).toHaveBeenCalledWith('org-target', {
        user_ids: ['user-1'],
        org_ids: ['org-target'],
      });
    });

    it('includes role when provided', async () => {
      await svc.assignOrg('alice@example.com', 'Target', { role: 'admin' });
      expect(api.addToOrgs).toHaveBeenCalledWith('org-target', {
        user_ids: ['user-1'],
        org_ids: ['org-target'],
        org_role: 'admin',
      });
    });

    it('does not call API in dry-run mode', async () => {
      await svc.assignOrg('alice@example.com', 'Target', { dryRun: true });
      expect(api.addToOrgs).not.toHaveBeenCalled();
    });
  });

  describe('setOnlyOrg', () => {
    it('matches user by email in enterprise member list', async () => {
      // Pass email — setOnlyOrg finds the user via u.email === emailOrId
      await svc.setOnlyOrg('alice@example.com', 'Target');
      expect(api.addToOrgs).toHaveBeenCalledWith('org-target', {
        user_ids: ['user-1'],
        org_ids: ['org-target'],
      });
    });

    it('dry-run does not call addToOrgs or removeFromOrgs', async () => {
      await svc.setOnlyOrg('alice@example.com', 'Target', { dryRun: true });
      expect(api.addToOrgs).not.toHaveBeenCalled();
      expect(api.removeFromOrgs).not.toHaveBeenCalled();
    });

    it('throws for unknown user', async () => {
      const emptyApi = { ...api, listEnterpriseMembers: vi.fn().mockResolvedValue([]) };
      const svc2 = new MembershipService(emptyApi as unknown as MembersApi, makeRegistry(), makeUserResolver());
      await expect(svc2.setOnlyOrg('nobody@example.com', 'Target')).rejects.toThrow('User not found');
    });

    it('calls removeFromOrgs with orgs to remove', async () => {
      await svc.setOnlyOrg('alice@example.com', 'Target');
      expect(api.removeFromOrgs).toHaveBeenCalledWith('user-1', [OTHER_ORG_ID]);
    });

    it('skips addToOrgs when user is already in target org', async () => {
      const userAlreadyIn: User = {
        user_id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        role_assignments: [
          { role: { role_id: 'r1', role_name: 'member', role_type: 'org' }, org_id: 'org-target' },
          { role: { role_id: 'r2', role_name: 'member', role_type: 'org' }, org_id: OTHER_ORG_ID },
        ],
      };
      vi.mocked(api.listEnterpriseMembers).mockResolvedValue([userAlreadyIn]);
      await svc.setOnlyOrg('alice@example.com', 'Target');
      expect(api.addToOrgs).not.toHaveBeenCalled();
      expect(api.removeFromOrgs).toHaveBeenCalledWith('user-1', [OTHER_ORG_ID]);
    });
  });
});
