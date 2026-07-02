import { Command } from 'commander';
import { buildContainer } from '../../container.js';
import { renderKV, renderTable, renderJson } from '../../utils/output.js';
import { formatMonth } from '../../utils/dates.js';
import { pctUsed } from '../../services/MonitoringService.js';
import type { AcusByProduct } from '../../models/types.js';

export function monitorCommand(): Command {
  const cmd = new Command('monitor').description('Monitor ACU consumption');

  cmd
    .command('org <org>')
    .description(
      'Show enterprise monthly consumption vs org ACU limit.\n' +
        '  NOTE: consumption figures are enterprise-wide (no per-org consumption endpoint in the API).'
    )
    .requiredOption('--month <YYYY-MM>', 'billing month')
    .action(async (org: string, opts, thisCmd) => {
      const isJson = Boolean(rootOpts(thisCmd).json);
      const { monitoringService } = buildContainer();
      const result = await monitoringService.monitorOrg(org, opts.month as string);

      if (isJson) return renderJson(result);

      const limit = result.cloudLimit ?? result.localLimit;
      console.log(`\nOrg: ${result.orgName} (${result.orgId})`);
      console.log(`Month: ${formatMonth(result.month)}`);
      console.log('\n  (Enterprise-wide consumption — no per-org filter available in API)\n');
      renderKV([
        ['Total ACUs', result.totalAcus],
        ['Cycle limit (cloud)', result.cloudLimit],
        ['Cycle limit (local)', result.localLimit],
        ['% of limit used', pctUsed(result.totalAcus, limit)],
        ['Remaining', limit !== undefined ? Math.max(0, limit - result.totalAcus) : 'N/A'],
      ]);
      if (Object.keys(result.byProduct).length > 0) {
        console.log('\nBy product:');
        renderKV(Object.entries(result.byProduct).map(([k, v]) => [k, v]));
      }
    });

  cmd
    .command('user <user>')
    .description('Show a user\'s monthly ACU consumption breakdown by product')
    .requiredOption('--month <YYYY-MM>', 'billing month')
    .action(async (user: string, opts, thisCmd) => {
      const isJson = Boolean(rootOpts(thisCmd).json);
      const { monitoringService } = buildContainer();
      const result = await monitoringService.monitorUser(user, opts.month as string);

      if (isJson) return renderJson(result);

      console.log(`\nUser: ${result.userId}`);
      console.log(`Month: ${formatMonth(result.month)}`);
      console.log();
      renderKV([
        ['Total ACUs', result.totalAcus],
        ['Cycle limit (local)', result.localLimit],
        ['% of limit used', pctUsed(result.totalAcus, result.localLimit)],
        ['Remaining', result.localLimit !== undefined ? Math.max(0, result.localLimit - result.totalAcus) : 'N/A'],
      ]);

      const productRows = productBreakdownRows(result.byProduct);
      if (productRows.length > 0) {
        console.log('\nBy product:');
        renderTable(productRows, ['product', 'acus'], ['Product', 'ACUs']);
      } else {
        console.log('\n  (no per-product breakdown available for this period)');
      }
    });

  return cmd;
}

function productBreakdownRows(byProduct: AcusByProduct): Record<string, unknown>[] {
  return Object.entries(byProduct)
    .filter(([, v]) => v != null && v > 0)
    .map(([k, v]) => ({ product: k, acus: v }))
    .sort((a, b) => (b.acus as number) - (a.acus as number));
}

function rootOpts(cmd: Command): Record<string, unknown> {
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts() as Record<string, unknown>;
}
