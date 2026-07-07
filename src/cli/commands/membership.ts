import { Command } from 'commander';
import { buildContainer } from '../../container.js';
import { renderKV, renderJson, renderTable } from '../../utils/output.js';

export function membershipCommand(): Command {
  const cmd = new Command('membership').description('Manage user org memberships');

  cmd
    .command('get-user <user>')
    .description('Show all details for a user (email or user_id)')
    .action(async (user: string, _opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { membershipService } = buildContainer();
      const u = await membershipService.getUser(user);
      if (ro.json) return renderJson(u);
      renderKV([
        ['user_id', u.user_id],
        ['email', u.email],
        ['name', u.name],
      ]);
      const orgRoles = (u.role_assignments ?? []).filter(
        (r) => r.role.role_type === 'org' && r.org_id
      );
      const entRoles = (u.role_assignments ?? []).filter(
        (r) => r.role.role_type === 'enterprise'
      );
      if (orgRoles.length > 0) {
        const { orgRegistry } = buildContainer();
        const orgs = await orgRegistry.get().catch(() => []);
        const nameMap = new Map(orgs.map((o) => [o.org_id, o.name]));
        console.log('\n  Org memberships:');
        for (const ra of orgRoles) {
          const orgName = nameMap.get(ra.org_id!) ?? '';
          const label = orgName ? `${ra.org_id}  ${orgName}` : ra.org_id!;
          console.log(`    ${label}  (${ra.role.role_name})`);
        }
      }
      if (entRoles.length > 0) {
        console.log('\n  Enterprise roles:');
        for (const ra of entRoles) {
          console.log(`    ${ra.role.role_name}`);
        }
      }
    });

  cmd
    .command('list-users')
    .description('List users in an organization')
    .requiredOption('--org <org>', 'organization name or org_id')
    .action(async (opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { membershipService } = buildContainer();
      const users = await membershipService.listOrgUsers(opts.org as string);
      if (ro.json) return renderJson(users);
      renderTable(
        users.map((u) => ({
          user_id: u.user_id,
          email: u.email,
          name: u.name,
          roles: (u.role_assignments ?? [])
            .filter((r) => r.role.role_type === 'org')
            .map((r) => r.role.role_name)
            .join(', '),
        })),
        ['user_id', 'email', 'name', 'roles']
      );
    });

  cmd
    .command('set-billing-org <user>')
    .description('Update the billing org for a user\'s ACU limit')
    .requiredOption('--billing-org <org>', 'billing org name or org_id')
    .action(async (user: string, opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { acuLimitService } = buildContainer();
      const result = await acuLimitService.setBillingOrg(
        user,
        opts.billingOrg as string,
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
    .command('assign <user>')
    .description('Add a user to an organization')
    .requiredOption('--org <org>', 'organization name or org_id')
    .option('--role <role>', 'org role to assign')
    .action(async (user: string, opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { membershipService } = buildContainer();
      await membershipService.assignOrg(user, opts.org as string, {
        role: opts.role as string | undefined,
        dryRun: Boolean(ro.dryRun),
      });
      if (!ro.dryRun) console.log(`Added ${user} to org ${opts.org as string}.`);
    });

  cmd
    .command('set-only <user>')
    .description(
      'Set the user\'s org membership to exactly one org (adds target, removes all others).\n' +
        '  NOTE: requires the "remove from org" endpoint to be confirmed (gap #1 in API docs).'
    )
    .requiredOption('--org <org>', 'organization name or org_id')
    .action(async (user: string, opts, thisCmd) => {
      const ro = rootOpts(thisCmd);
      const { membershipService } = buildContainer();
      await membershipService.setOnlyOrg(user, opts.org as string, {
        dryRun: Boolean(ro.dryRun),
      });
      if (!ro.dryRun) console.log(`Done — ${user} is now a member of only ${opts.org as string}.`);
    });

  return cmd;
}

function rootOpts(cmd: Command): Record<string, unknown> {
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts() as Record<string, unknown>;
}
