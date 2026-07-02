import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { OrganizationsApi } from '../api/OrganizationsApi.js';
import type { IOrgRegistry } from './IOrgRegistry.js';
import type { Organization } from '../models/types.js';

export class OrgRegistry implements IOrgRegistry {
  private cached: Organization[] | null = null;

  constructor(
    private readonly orgsApi: OrganizationsApi,
    private readonly cachePath: string
  ) {}

  async get(refresh = false): Promise<Organization[]> {
    if (refresh) return this.refresh();
    if (this.cached) return this.cached;

    const disk = await this.loadFromDisk();
    if (disk) {
      this.cached = disk;
      return this.cached;
    }

    return this.refresh();
  }

  async refresh(): Promise<Organization[]> {
    const orgs = await this.orgsApi.list();
    this.cached = orgs;
    await this.saveToDisk(orgs);
    return orgs;
  }

  async resolve(nameOrId: string): Promise<Organization> {
    const orgs = await this.get();
    const found = orgs.find((o) => o.org_id === nameOrId || o.name === nameOrId);
    if (!found) {
      throw new Error(
        `Organization not found: "${nameOrId}". Run 'orgs refresh' to update the cache.`
      );
    }
    return found;
  }

  private async loadFromDisk(): Promise<Organization[] | null> {
    try {
      const raw = await readFile(this.cachePath, 'utf8');
      return JSON.parse(raw) as Organization[];
    } catch {
      return null;
    }
  }

  private async saveToDisk(orgs: Organization[]): Promise<void> {
    await mkdir(dirname(this.cachePath), { recursive: true });
    await writeFile(this.cachePath, JSON.stringify(orgs, null, 2), 'utf8');
  }
}
