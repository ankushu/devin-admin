import type { DevinHttpClient } from '../http/DevinHttpClient.js';
import type { User, AddMembersBody } from '../models/types.js';

export class MembersApi {
  constructor(private readonly http: DevinHttpClient) {}

  listOrgMembers(orgId: string, email?: string): Promise<User[]> {
    const query: Record<string, string | number | boolean | undefined> = { first: 200 };
    if (email) query.email = email;
    return this.http.paginateAll<User>(`/v3/enterprise/organizations/${orgId}/members/users`, query);
  }

  listEnterpriseMembers(email?: string): Promise<User[]> {
    const query: Record<string, string | number | boolean | undefined> = { first: 200 };
    if (email) query.email = email;
    return this.http.paginateAll<User>('/v3/enterprise/members/users', query);
  }

  async addToOrgs(orgId: string, body: AddMembersBody): Promise<void> {
    await this.http.request('POST', `/v2/enterprise/organizations/${orgId}/members`, { body });
  }

  // Removes a user from each org individually.
  async removeFromOrgs(userId: string, orgIds: string[]): Promise<void> {
    await Promise.all(
      orgIds.map((orgId) =>
        this.http.request('DELETE', `/v3/enterprise/organizations/${orgId}/members/users/${userId}`)
      )
    );
  }
}
