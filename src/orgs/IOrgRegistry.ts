import type { Organization } from '../models/types.js';

export interface IOrgRegistry {
  get(refresh?: boolean): Promise<Organization[]>;
  refresh(): Promise<Organization[]>;
  resolve(nameOrId: string): Promise<Organization>;
}
