import { Command } from 'commander';
import { buildContainer } from '../../container.js';

export function membershipCommand(): Command {
  const cmd = new Command('membership').description('Manage user org memberships');

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
