#!/usr/bin/env node
import { Command } from 'commander';
import { orgsCommand } from './commands/orgs.js';
import { acuCommand } from './commands/acu.js';
import { membershipCommand } from './commands/membership.js';
import { monitorCommand } from './commands/monitor.js';

const program = new Command('devin-admin')
  .version('0.1.0')
  .description('Devin Enterprise admin CLI — manage multiple orgs, ACU limits, and consumption')
  .option('--json', 'output raw JSON instead of tables')
  .option('--dry-run', 'print the intended API request without executing it');

program.addCommand(orgsCommand());
program.addCommand(acuCommand());
program.addCommand(membershipCommand());
program.addCommand(monitorCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exit(1);
});
