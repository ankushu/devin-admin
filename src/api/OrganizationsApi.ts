import type { DevinHttpClient } from '../http/DevinHttpClient.js';
import type { Organization } from '../models/types.js';

export class OrganizationsApi {
  constructor(private readonly http: DevinHttpClient) {}

  list(): Promise<Organization[]> {
    return this.http.paginateAll<Organization>('/v3/enterprise/organizations', { first: 200 });
  }
}
