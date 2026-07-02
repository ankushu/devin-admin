import { Command } from 'commander';
import { buildContainer } from '../../container.js';
import { renderTable, renderJson } from '../../utils/output.js';

export function orgsCommand(): Command {
  const cmd = new Command('orgs').description('Manage organization cache');

  cmd
    .command('list')
    .description('List organizations (uses local cache; auto-fetches if empty)')
    .option('--refresh', 'force refresh from API')
    .action(async (opts, thisCmd) => {
      const isJson = rootOpts(thisCmd).json as boolean | undefined;
      const { orgRegistry } = buildContainer();
      const orgs = await orgRegistry.get(opts.refresh as boolean);

      if (isJson) {
        renderJson(orgs);
      } else {
        console.log(`${orgs.length} organization(s)`);
        renderTable(orgs as unknown as Record<string, unknown>[], ['org_id', 'name'], ['Org ID', 'Name']);
      }
    });

  cmd
    .command('refresh')
    .description('Refresh organization list from API and update cache')
    .action(async (_opts, thisCmd) => {
      const isJson = rootOpts(thisCmd).json as boolean | undefined;
      const { orgRegistry } = buildContainer();
      const orgs = await orgRegistry.refresh();

      if (isJson) {
        renderJson(orgs);
      } else {
        console.log(`Refreshed: ${orgs.length} organization(s) cached.`);
        renderTable(orgs as unknown as Record<string, unknown>[], ['org_id', 'name'], ['Org ID', 'Name']);
      }
    });

  return cmd;
}

// Walk up the command chain to get root program opts (--json, --dry-run).
function rootOpts(cmd: Command): Record<string, unknown> {
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts() as Record<string, unknown>;
}
