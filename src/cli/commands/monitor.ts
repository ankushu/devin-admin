import { Command } from 'commander';
import { buildContainer } from '../../container.js';
import { renderKV, renderTable, renderJson } from '../../utils/output.js';
import { formatMonth } from '../../utils/dates.js';
import { pctUsed, pctOfTotal } from '../../services/MonitoringService.js';
import type { AcusByProduct } from '../../models/types.js';
import { requireAtLeastOne, requireMutuallyExclusive, requireTogether } from '../../utils/cliOptions.js';
import { formatBillingOrg } from '../../utils/billingOrg.js';

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
        ['Total ACUs', result.totalAcus.toFixed(2)],
        ['Cycle limit (cloud)', result.cloudLimit],
        ['Cycle limit (local)', result.localLimit],
      ]);

      if (result.cycles.length > 0) {
        console.log('\nCycle breakdown:');
        renderTable(
          result.cycles.map((c) => ({
            cycle: formatMonth(c.cycleId),
            acus: c.totalAcus.toFixed(2),
            limit: limit ?? 'N/A',
            pct: pctUsed(c.totalAcus, limit),
          })),
          ['cycle', 'acus', 'limit', 'pct'],
          ['Cycle', 'ACUs Used', 'Limit', '% Used']
        );
        if (result.isPartialCycle) {
          console.log('\n  * Note: \'% Used\' reflects ACUs consumed during the requested period only; there may be more usage in the full cycle.');
        }
      }

      if (Object.keys(result.byProduct).length > 0) {
        console.log('\nBy product:');
        renderKV(Object.entries(result.byProduct).map(([k, v]) => [k, v]));
      }
      if (result.dailyTrend.length > 0) {
        console.log('\nDaily trend:');
        renderDailyTrendTable(result.dailyTrend);
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
      const { monitoringService, orgRegistry } = buildContainer();
      const period = resolvePeriodOptions(opts);
      const result = await monitoringService.monitorUser(user, period);

      if (isJson) return renderJson(result);

      console.log(`\nUser: ${result.userId}`);
      console.log(`Period: ${formatPeriodLabel(result.month)}`);
      console.log();
      renderKV([
        ['Total ACUs', result.totalAcus.toFixed(2)],
        ['Cycle limit (local)', result.localLimit],
        ['Billing org', await formatBillingOrg(orgRegistry, result.billingOrgId)],
      ]);

      if (result.cycles.length > 0) {
        console.log('\nCycle breakdown:');
        renderTable(
          result.cycles.map((c) => ({
            cycle: formatMonth(c.cycleId),
            acus: c.totalAcus.toFixed(2),
            limit: result.localLimit ?? 'N/A',
            pct: pctUsed(c.totalAcus, result.localLimit),
          })),
          ['cycle', 'acus', 'limit', 'pct'],
          ['Cycle', 'ACUs Used', 'Limit', '% Used']
        );
        if (result.isPartialCycle) {
          console.log('\n  * Note: \'% Used\' reflects ACUs consumed during the requested period only; there may be more usage in the full cycle.');
        }
      }

      const productRows = productBreakdownRows(result.byProduct);
      if (productRows.length > 0) {
        console.log('\nBy product:');
        renderTable(productRows, ['product', 'acus'], ['Product', 'ACUs']);
      } else {
        console.log('\n  (no per-product breakdown available for this period)');
      }

      if (result.dailyTrend.length > 0) {
        console.log('\nDaily trend:');
        renderDailyTrendTable(result.dailyTrend);
      }
    });

  cmd
    .command('all-orgs')
    .description('Show ACU consumption for all organizations with product breakdown')
    .option('--month <YYYY-MM>', 'billing month')
    .option('--start <YYYY-MM-DD>', 'start date (inclusive)')
    .option('--end <YYYY-MM-DD>', 'end date (inclusive)')
    .action(async (opts, thisCmd) => {
      const isJson = Boolean(rootOpts(thisCmd).json);
      const { monitoringService } = buildContainer();
      const period = resolvePeriodOptions(opts);
      const result = await monitoringService.monitorAllOrgs(period);

      if (isJson) return renderJson(result);

      console.log(`\nPeriod: ${formatPeriodLabel(result.month)}`);
      console.log();

      const tableRows = result.orgs.map((org) => {
        const row: Record<string, unknown> = {
          org: org.orgName,
          acu: org.totalAcus.toFixed(2),
          pct: pctUsed(org.totalAcus, org.limit),
        };

        // Add product breakdown as percentage of total
        row.devin = formatProductBreakdown(org.byProduct.devin, org.totalAcus);
        row.cascade = formatProductBreakdown(org.byProduct.cascade, org.totalAcus);
        row.review = formatProductBreakdown(org.byProduct.review, org.totalAcus);
        row.terminal = formatProductBreakdown(org.byProduct.terminal, org.totalAcus);

        return row;
      });

      renderTable(
        tableRows,
        ['org', 'acu', 'pct', 'devin', 'cascade', 'review', 'terminal'],
        ['Org', 'ACU', '% Used', 'Devin', 'Cascade', 'Review', 'Terminal']
      );
    });

  registerActiveUsersCommand(cmd, {
    name: 'dau',
    label: 'Daily Active Users (DAU)',
    granularity: 'daily',
    periodHeader: 'Date',
  });
  registerActiveUsersCommand(cmd, {
    name: 'wau',
    label: 'Weekly Active Users (WAU, ISO week)',
    granularity: 'weekly',
    periodHeader: 'Week',
  });
  registerActiveUsersCommand(cmd, {
    name: 'mau',
    label: 'Monthly Active Users (MAU)',
    granularity: 'monthly',
    periodHeader: 'Month',
  });

  return cmd;
}

interface ActiveUsersCommandSpec {
  name: 'dau' | 'wau' | 'mau';
  label: string;
  granularity: 'daily' | 'weekly' | 'monthly';
  periodHeader: string;
}

function registerActiveUsersCommand(cmd: Command, spec: ActiveUsersCommandSpec): void {
  cmd
    .command(`${spec.name} <org>`)
    .description(
      `Show ${spec.label} for an org.\n` +
        '  NOTE: derived from per-user ACU consumption — there is no bulk active-users or\n' +
        '  per-tool (Desktop/CLI/Cloud) API. Users on non-premium/free models that consume\n' +
        '  no ACUs will not be counted, so these figures may undercount true active users.'
    )
    .option('--month <YYYY-MM>', 'billing month')
    .option('--start <YYYY-MM-DD>', 'start date (inclusive)')
    .option('--end <YYYY-MM-DD>', 'end date (inclusive)')
    .action(async (org: string, opts, thisCmd) => {
      const isJson = Boolean(rootOpts(thisCmd).json);
      const { monitoringService } = buildContainer();
      const period = resolvePeriodOptions(opts);

      if (!isJson) process.stderr.write('Resolving org and listing members...\n');

      const onProgress = isJson
        ? undefined
        : (done: number, total: number) => {
            process.stderr.write(`\rFetching consumption for org members... ${done}/${total}`);
            if (done === total) process.stderr.write('\n');
          };

      const result = await monitoringService.monitorActiveUsers(org, period, onProgress);

      if (isJson) return renderJson(result);

      console.log(`\nOrg: ${result.orgName} (${result.orgId})`);
      console.log(`Period: ${formatPeriodLabel(result.month)}`);
      console.log();
      renderKV([
        ['Total org members', result.totalMembers],
        ['Unique active users (period)', result.overallActiveUsers],
        ['Users skipped (fetch errors)', result.usersSkipped],
      ]);

      console.log(`\n${spec.label}:`);
      renderTable(
        result[spec.granularity].map((row) => ({ period: row.period, active: row.activeUsers })),
        ['period', 'active'],
        [spec.periodHeader, 'Active Users']
      );

      console.log('\nActive users:');
      renderTable(
        result.activeUsers.map((u) => ({ user_id: u.user_id, email: u.email, name: u.name })),
        ['user_id', 'email', 'name'],
        ['User ID', 'Email', 'Name']
      );

      if (result.failedUsers.length > 0) {
        console.log('\nFailed to fetch consumption after retries (needs manual follow-up):');
        renderTable(
          result.failedUsers.map((u) => ({ user_id: u.user_id, email: u.email, name: u.name })),
          ['user_id', 'email', 'name'],
          ['User ID', 'Email', 'Name']
        );
      }

      console.log(`\nWARNING: ${result.warning}`);
    });
}

function productBreakdownRows(byProduct: AcusByProduct): Record<string, unknown>[] {
  return Object.entries(byProduct)
    .filter(([, v]) => v != null && v > 0)
    .map(([k, v]) => ({ product: k, acus: (v as number).toFixed(2) }))
    .sort((a, b) => parseFloat(b.acus as string) - parseFloat(a.acus as string));
}

function renderDailyTrendTable(dailyTrend: import('../../services/MonitoringService.js').DailyTrendRow[]): void {
  // Extract all unique product names from the daily trend data
  const productNames = new Set<string>();
  for (const row of dailyTrend) {
    if (row.byProduct) {
      for (const productName of Object.keys(row.byProduct)) {
        productNames.add(productName);
      }
    }
  }

  // Sort product names alphabetically for consistent column ordering
  const sortedProductNames = Array.from(productNames).sort();

  // Build the table rows
  const tableRows = dailyTrend.map((row) => {
    const rowObj: Record<string, unknown> = {
      date: row.date,
      acus: row.acus.toFixed(2),
    };

    // Add each product's ACUs to the row
    for (const productName of sortedProductNames) {
      const value = row.byProduct?.[productName] ?? 0;
      rowObj[productName] = typeof value === 'number' ? value.toFixed(2) : value;
    }

    return rowObj;
  });

  // Build column keys and headers
  const columnKeys = ['date', 'acus', ...sortedProductNames];
  const columnHeaders = ['Date', 'ACUs', ...sortedProductNames.map((p) => p.charAt(0).toUpperCase() + p.slice(1))];

  renderTable(tableRows, columnKeys, columnHeaders);
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

  requireMutuallyExclusive(opts, ['month', 'start'], 'Use either --month or --start/--end, not both');
  requireMutuallyExclusive(opts, ['month', 'end'], 'Use either --month or --start/--end, not both');
  requireTogether(opts, ['start', 'end'], 'Both --start and --end are required together');
  requireAtLeastOne(opts, ['month', 'start'], 'Provide either --month <YYYY-MM> or --start <YYYY-MM-DD> --end <YYYY-MM-DD>');

  if (hasMonth) return { month: month! };
  return { start: start!, end: end! };
}

function formatPeriodLabel(period: string): string {
  if (period.includes('..')) return period;
  return formatMonth(period);
}

function formatProductBreakdown(value: number | null | undefined, total: number): string {
  if (value == null || value === 0) return '0.00 (0.00%)';
  const pct = pctOfTotal(value, total);
  return `${value.toFixed(2)} (${pct})`;
}
