import type { DevinHttpClient } from '../http/DevinHttpClient.js';
import type { Organization, OrganizationUpdateRequest } from '../models/types.js';

export class OrganizationsApi {
  constructor(private readonly http: DevinHttpClient) {}

  list(): Promise<Organization[]> {
    return this.http.paginateAll<Organization>('/v3/enterprise/organizations', { first: 200 });
  }

  update(orgId: string, body: OrganizationUpdateRequest): Promise<Organization> {
    return this.http.request('PATCH', `/v3/enterprise/organizations/${orgId}`, { body });
  }
}
