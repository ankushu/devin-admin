import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from '../src/services/MembershipService.js';
import type { MembersApi } from '../src/api/MembersApi.js';
import type { OrgRegistry } from '../src/orgs/OrgRegistry.js';
import type { UserResolver } from '../src/users/UserResolver.js';
import type { AcuLimitService } from '../src/services/AcuLimitService.js';
import type { User } from '../src/models/types.js';

const TARGET_ORG = { org_id: 'org-target', name: 'Target', created_at: 0, updated_at: 0, max_session_acu_limit: null, max_cycle_acu_limit: null };
const PROTECTED_ORG = { org_id: 'org-protected', name: 'Service Now', created_at: 0, updated_at: 0, max_session_acu_limit: null, max_cycle_acu_limit: null };
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
  return {
    resolve: vi.fn().mockImplementation((nameOrId: string) => {
      if (nameOrId === PROTECTED_ORG.org_id || nameOrId === PROTECTED_ORG.name) {
        return Promise.resolve(PROTECTED_ORG);
      }
      return Promise.resolve(TARGET_ORG);
    }),
  } as unknown as OrgRegistry;
}

function makeUserResolver(resolvedId = 'user-1'): UserResolver {
  return { resolveId: vi.fn().mockResolvedValue(resolvedId) } as unknown as UserResolver;
}

function makeAcuLimitService(): AcuLimitService {
  return { setBillingOrg: vi.fn().mockResolvedValue(null) } as unknown as AcuLimitService;
}

describe('MembershipService', () => {
  let api: MembersApi;
  let acuLimitService: AcuLimitService;
  let svc: MembershipService;

  beforeEach(() => {
    api = makeMembersApi();
    acuLimitService = makeAcuLimitService();
    svc = new MembershipService(api, makeRegistry(), makeUserResolver(), acuLimitService);
  });

  describe('assignOrg', () => {
    it('resolves email to user_id before calling addToOrgs', async () => {
      const resolver = makeUserResolver('user-1');
      const svc2 = new MembershipService(api, makeRegistry(), resolver, acuLimitService);
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
      const svc2 = new MembershipService(
        emptyApi as unknown as MembersApi,
        makeRegistry(),
        makeUserResolver(),
        acuLimitService
      );
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

    it('updates billing org to the target org after a successful move', async () => {
      await svc.setOnlyOrg('alice@example.com', 'Target');
      expect(acuLimitService.setBillingOrg).toHaveBeenCalledWith('user-1', 'org-target', false);
    });

    it('previews the billing-org update in dry-run mode without calling it live', async () => {
      await svc.setOnlyOrg('alice@example.com', 'Target', { dryRun: true });
      expect(acuLimitService.setBillingOrg).toHaveBeenCalledWith('user-1', 'org-target', true);
    });

    it('retains membership in the protected "Protected" org when moving to a different target', async () => {
      const userInProtectedOrg: User = {
        user_id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        role_assignments: [
          { role: { role_id: 'r1', role_name: 'member', role_type: 'org' }, org_id: OTHER_ORG_ID },
          { role: { role_id: 'r2', role_name: 'admin', role_type: 'org' }, org_id: PROTECTED_ORG.org_id },
        ],
      };
      vi.mocked(api.listEnterpriseMembers).mockResolvedValue([userInProtectedOrg]);
      await svc.setOnlyOrg('alice@example.com', 'Target');
      expect(api.removeFromOrgs).toHaveBeenCalledWith('user-1', [OTHER_ORG_ID]);
    });

    it('reverts org membership and throws if the billing-org update fails', async () => {
      vi.mocked(acuLimitService.setBillingOrg).mockRejectedValue(new Error('billing api down'));
      await expect(svc.setOnlyOrg('alice@example.com', 'Target')).rejects.toThrow('billing api down');
      // Reverts: removed from the newly-added target org, re-added to the original org.
      expect(api.removeFromOrgs).toHaveBeenNthCalledWith(2, 'user-1', ['org-target']);
      expect(api.addToOrgs).toHaveBeenNthCalledWith(2, OTHER_ORG_ID, {
        user_ids: ['user-1'],
        org_ids: [OTHER_ORG_ID],
      });
    });
  });
});
