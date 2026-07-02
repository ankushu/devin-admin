import { Command } from 'commander';
import { buildContainer } from '../../container.js';
import { renderKV, renderJson } from '../../utils/output.js';

export function acuCommand(): Command {
  const cmd = new Command('acu').description('Manage ACU limits');

  // ── org limits ──────────────────────────────────────────────────────────────

  cmd
    .command('get-org <org>')
    .description('Get ACU limits for an organization')
    .action(async (org: string, _opts, thisCmd) => {
      const { acuLimitService } = buildContainer();
      const limit = await acuLimitService.getOrg(org);
      if (rootOpts(thisCmd).json) return renderJson(limit);
      renderKV([
        ['local_agent.cycle_acu_limit', limit.local_agent?.cycle_acu_limit],
        ['cloud_agent.cycle_acu_limit', limit.cloud_agent?.cycle_acu_limit],
      ]);
    });

  cmd
    .command('set-org <org>')
    .description('Set ACU limits for an organization')
    .requiredOption('--local <n>', 'local agent cycle ACU limit', Number)
    .option('--cloud <n>', 'cloud agent cycle ACU limit', Number)
    .action(async (org: string, opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { acuLimitService } = buildContainer();
      const result = await acuLimitService.setOrg(
        org,
        { local: opts.local as number, cloud: opts.cloud as number | undefined },
        Boolean(ro.dryRun)
      );
      if (ro.dryRun) return;
      if (ro.json) return renderJson(result ?? {});
      console.log('Updated.');
      if (result) renderKV([
        ['local_agent.cycle_acu_limit', result.local_agent?.cycle_acu_limit],
        ['cloud_agent.cycle_acu_limit', result.cloud_agent?.cycle_acu_limit],
      ]);
    });

  cmd
    .command('clear-org <org>')
    .description('Remove ACU limit override for an organization')
    .action(async (org: string, _opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { acuLimitService } = buildContainer();
      await acuLimitService.clearOrg(org, Boolean(ro.dryRun));
      if (!ro.dryRun) console.log('Cleared.');
    });

  // ── user limits ─────────────────────────────────────────────────────────────

  cmd
    .command('get-user <user>')
    .description('Get ACU limits for a user (user_id)')
    .action(async (user: string, _opts, thisCmd) => {
      const { acuLimitService } = buildContainer();
      const limit = await acuLimitService.getUser(user);
      if (rootOpts(thisCmd).json) return renderJson(limit);
      renderKV([
        ['local_agent.cycle_acu_limit', limit.local_agent?.cycle_acu_limit],
        ['local_agent.billing_org_id', limit.local_agent?.billing_org_id],
      ]);
    });

  cmd
    .command('set-user <user>')
    .description('Set ACU limits for a user (user_id)')
    .requiredOption('--local <n>', 'local agent cycle ACU limit', Number)
    .option('--billing-org <org>', 'billing org name or org_id')
    .action(async (user: string, opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { acuLimitService } = buildContainer();
      const result = await acuLimitService.setUser(
        user,
        { local: opts.local as number, billingOrg: opts.billingOrg as string | undefined },
        Boolean(ro.dryRun)
      );
      if (ro.dryRun) return;
      if (ro.json) return renderJson(result ?? {});
      console.log('Updated.');
      if (result) renderKV([
        ['local_agent.cycle_acu_limit', result.local_agent?.cycle_acu_limit],
        ['local_agent.billing_org_id', result.local_agent?.billing_org_id],
      ]);
    });

  cmd
    .command('clear-user <user>')
    .description('Remove ACU limit override for a user')
    .action(async (user: string, _opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { acuLimitService } = buildContainer();
      await acuLimitService.clearUser(user, Boolean(ro.dryRun));
      if (!ro.dryRun) console.log('Cleared.');
    });

  // ── default user limit ───────────────────────────────────────────────────────

  cmd
    .command('get-default')
    .description('Get the default ACU limit applied to all users')
    .action(async (_opts, thisCmd) => {
      const { acuLimitService } = buildContainer();
      const limit = await acuLimitService.getDefault();
      if (rootOpts(thisCmd).json) return renderJson(limit);
      renderKV([['local_agent.cycle_acu_limit', limit.local_agent?.cycle_acu_limit]]);
    });

  cmd
    .command('set-default')
    .description('Set the default ACU limit for all users')
    .requiredOption('--local <n>', 'local agent cycle ACU limit', Number)
    .action(async (opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { acuLimitService } = buildContainer();
      const result = await acuLimitService.setDefault(opts.local as number, Boolean(ro.dryRun));
      if (ro.dryRun) return;
      if (ro.json) return renderJson(result ?? {});
      console.log('Updated.');
      if (result) renderKV([['local_agent.cycle_acu_limit', result.local_agent?.cycle_acu_limit]]);
    });

  return cmd;
}

function rootOpts(cmd: Command): Record<string, unknown> {
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts() as Record<string, unknown>;
}
