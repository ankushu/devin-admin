import type { IHttpClient } from '../http/IHttpClient.js';
import type {
  OrgAcuLimitResponse,
  UserAcuLimitResponse,
  SetOrgAcuLimitBody,
  SetUserAcuLimitBody,
} from '../models/types.js';

export class AcuLimitsApi {
  constructor(private readonly http: IHttpClient) {}

  getOrg(orgId: string): Promise<OrgAcuLimitResponse> {
    return this.http.request('GET', `/v3beta1/enterprise/organizations/${orgId}/consumption/acu-limits`);
  }

  setOrg(orgId: string, body: SetOrgAcuLimitBody): Promise<OrgAcuLimitResponse> {
    return this.http.request('PATCH', `/v3beta1/enterprise/organizations/${orgId}/consumption/acu-limits`, { body });
  }

  clearOrg(orgId: string): Promise<void> {
    return this.http.request('DELETE', `/v3beta1/enterprise/organizations/${orgId}/consumption/acu-limits`);
  }

  getUser(userId: string): Promise<UserAcuLimitResponse> {
    return this.http.request('GET', `/v3beta1/enterprise/users/${userId}/consumption/acu-limits`);
  }

  setUser(userId: string, body: SetUserAcuLimitBody): Promise<UserAcuLimitResponse> {
    return this.http.request('PATCH', `/v3beta1/enterprise/users/${userId}/consumption/acu-limits`, { body });
  }

  clearUser(userId: string): Promise<void> {
    return this.http.request('DELETE', `/v3beta1/enterprise/users/${userId}/consumption/acu-limits`);
  }

  getDefault(): Promise<UserAcuLimitResponse> {
    return this.http.request('GET', '/v3beta1/enterprise/users/consumption/acu-limits');
  }

  setDefault(body: SetUserAcuLimitBody): Promise<UserAcuLimitResponse> {
    return this.http.request('PATCH', '/v3beta1/enterprise/users/consumption/acu-limits', { body });
  }

  clearDefault(): Promise<void> {
    return this.http.request('DELETE', '/v3beta1/enterprise/users/consumption/acu-limits');
  }
}
