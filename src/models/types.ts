export interface PaginatedResponse<T> {
  items: T[];
  has_next_page?: boolean;
  end_cursor?: string | null;
  total?: number | null;
}

export interface Organization {
  org_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  max_session_acu_limit: number | null;
  max_cycle_acu_limit: number | null;
}

export interface Role {
  role_id: string;
  role_name: string;
  role_type: 'enterprise' | 'org';
}

export interface RoleAssignment {
  role: Role;
  org_id?: string | null;
}

export interface User {
  user_id: string;
  email: string | null;
  name: string | null;
  role_assignments: RoleAssignment[];
}

export interface AgentAcuLimit {
  cycle_acu_limit: number;
}

export interface UserAgentAcuLimit {
  cycle_acu_limit: number;
  billing_org_id?: string;
}

export interface OrgAcuLimitResponse {
  local_agent?: AgentAcuLimit;
  cloud_agent?: AgentAcuLimit;
}

export interface UserAcuLimitResponse {
  local_agent?: UserAgentAcuLimit;
}

export interface SetOrgAcuLimitBody {
  local_agent?: { cycle_acu_limit: number };
  cloud_agent?: { cycle_acu_limit: number };
}

export interface SetUserAcuLimitBody {
  local_agent?: { cycle_acu_limit?: number; billing_org_id?: string };
}

export interface AcusByProduct {
  devin?: number;
  cascade?: number;
  terminal?: number;
  review?: number | null;
  [key: string]: number | null | undefined;
}

export interface ConsumptionDay {
  date: number; // Unix timestamp
  acus: number;
  acus_by_product?: AcusByProduct;
}

export interface ConsumptionResponse {
  total_acus: number;
  consumption_by_date: ConsumptionDay[];
}

export interface AddMembersBody {
  user_ids: string[];
  org_ids: string[];
  org_role?: string;
  group_names?: string[];
}
