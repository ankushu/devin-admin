import type { IHttpClient } from '../http/IHttpClient.js';
import type { ConsumptionResponse } from '../models/types.js';

export interface TimeRange {
  time_after: number;
  time_before: number;
}

export class ConsumptionApi {
  constructor(private readonly http: IHttpClient) {}

  getEnterpriseDaily(range: TimeRange): Promise<ConsumptionResponse> {
    return this.http.request('GET', '/v3/enterprise/consumption/daily', {
      query: { time_after: range.time_after, time_before: range.time_before },
    });
  }

  getOrgDaily(orgId: string, range: TimeRange): Promise<ConsumptionResponse> {
    return this.http.request('GET', `/v3/enterprise/consumption/daily/organizations/${orgId}`, {
      query: { time_after: range.time_after, time_before: range.time_before },
    });
  }

  getUserDaily(userId: string, range: TimeRange): Promise<ConsumptionResponse> {
    return this.http.request('GET', `/v3/enterprise/consumption/daily/users/${userId}`, {
      query: { time_after: range.time_after, time_before: range.time_before },
    });
  }
}
