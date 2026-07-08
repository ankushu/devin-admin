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
    .option('--month <YYYY-MM>', 'billing month')
    .option('--start <YYYY-MM-DD>', 'start date (inclusive)')
    .option('--end <YYYY-MM-DD>', 'end date (inclusive)')
    .action(async (org: string, opts, thisCmd) => {
      const isJson = Boolean(rootOpts(thisCmd).json);
      const { monitoringService } = buildContainer();
      const period = resolvePeriodOptions(opts);
      const result = await monitoringService.monitorOrg(org, period);

      if (isJson) return renderJson(result);

      const limit = result.cloudLimit ?? result.localLimit;
      console.log(`\nOrg: ${result.orgName} (${result.orgId})`);
      console.log(`Period: ${formatPeriodLabel(result.month)}`);
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
      if (result.dailyTrend.length > 0) {
        console.log('\nDaily trend:');
        renderTable(
          result.dailyTrend.map((row) => ({ date: row.date, acus: row.acus })),
          ['date', 'acus'],
          ['Date', 'ACUs']
        );
      }
    });

  cmd
    .command('user <user>')
    .description('Show a user\'s monthly ACU consumption breakdown by product')
    .option('--month <YYYY-MM>', 'billing month')
    .option('--start <YYYY-MM-DD>', 'start date (inclusive)')
    .option('--end <YYYY-MM-DD>', 'end date (inclusive)')
    .action(async (user: string, opts, thisCmd) => {
      const isJson = Boolean(rootOpts(thisCmd).json);
      const { monitoringService } = buildContainer();
      const period = resolvePeriodOptions(opts);
      const result = await monitoringService.monitorUser(user, period);

      if (isJson) return renderJson(result);

      console.log(`\nUser: ${result.userId}`);
      console.log(`Period: ${formatPeriodLabel(result.month)}`);
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

      if (result.dailyTrend.length > 0) {
        console.log('\nDaily trend:');
        renderTable(
          result.dailyTrend.map((row) => ({ date: row.date, acus: row.acus })),
          ['date', 'acus'],
          ['Date', 'ACUs']
        );
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

function resolvePeriodOptions(opts: { month?: string; start?: string; end?: string }): { month: string } | { start: string; end: string } {
  const month = opts.month?.trim();
  const start = opts.start?.trim();
  const end = opts.end?.trim();
  const hasMonth = Boolean(month);
  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);

  if (hasMonth && (hasStart || hasEnd)) {
    throw new Error('Use either --month or --start/--end, not both');
  }
  if (hasMonth) return { month: month! };
  if (hasStart !== hasEnd) {
    throw new Error('Both --start and --end are required together');
  }
  if (hasStart && hasEnd) return { start: start!, end: end! };
  throw new Error('Provide either --month <YYYY-MM> or --start <YYYY-MM-DD> --end <YYYY-MM-DD>');
}

function formatPeriodLabel(period: string): string {
  if (period.includes('..')) return period;
  return formatMonth(period);
}
