import { getConfig } from './config/config.js';
import { DevinHttpClient } from './http/DevinHttpClient.js';
import { OrganizationsApi } from './api/OrganizationsApi.js';
import { MembersApi } from './api/MembersApi.js';
import { AcuLimitsApi } from './api/AcuLimitsApi.js';
import { ConsumptionApi } from './api/ConsumptionApi.js';
import { OrgRegistry } from './orgs/OrgRegistry.js';
import { UserResolver } from './users/UserResolver.js';
import { AcuLimitService } from './services/AcuLimitService.js';
import { MembershipService } from './services/MembershipService.js';
import { MonitoringService } from './services/MonitoringService.js';

export interface Container {
  orgRegistry: OrgRegistry;
  acuLimitService: AcuLimitService;
  membershipService: MembershipService;
  monitoringService: MonitoringService;
}

export function buildContainer(): Container {
  const config = getConfig();
  const http = new DevinHttpClient(config.DEVIN_API_BASE_URL, config.DEVIN_API_TOKEN);

  const orgsApi = new OrganizationsApi(http);
  const membersApi = new MembersApi(http);
  const acuLimitsApi = new AcuLimitsApi(http);
  const consumptionApi = new ConsumptionApi(http);

  const orgRegistry = new OrgRegistry(orgsApi, config.ORG_CACHE_PATH);
  const userResolver = new UserResolver(membersApi);

  return {
    orgRegistry,
    acuLimitService: new AcuLimitService(acuLimitsApi, orgRegistry, userResolver),
    membershipService: new MembershipService(membersApi, orgRegistry, userResolver),
    monitoringService: new MonitoringService(consumptionApi, acuLimitsApi, orgRegistry, userResolver),
  };
}
