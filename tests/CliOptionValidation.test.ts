import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { requireAtLeastOne, requireMutuallyExclusive, requireTogether } from '../src/utils/cliOptions.js';

const setOrg = vi.fn();

vi.mock('../src/container.js', () => ({
  buildContainer: () => ({
    acuLimitService: { setOrg },
  }),
}));

describe('CLI option validators', () => {
  it('requires at least one option', () => {
    expect(() => requireAtLeastOne({}, ['local', 'cloud'])).toThrow('Provide at least one of --local or --cloud');
    expect(() => requireAtLeastOne({ cloud: 600 }, ['local', 'cloud'])).not.toThrow();
  });

  it('requires options in a group together', () => {
    expect(() => requireTogether({ start: '2026-06-01' }, ['start', 'end'])).toThrow(
      'Options --start and --end must be provided together'
    );
    expect(() => requireTogether({ start: '2026-06-01', end: '2026-06-02' }, ['start', 'end'])).not.toThrow();
  });

  it('rejects mutually exclusive options', () => {
    expect(() => requireMutuallyExclusive({ month: '2026-06', start: '2026-06-01' }, ['month', 'start'])).toThrow(
      'Options --month and --start are mutually exclusive'
    );
    expect(() => requireMutuallyExclusive({ month: '2026-06' }, ['month', 'start'])).not.toThrow();
  });
});

describe('acu set-org options', () => {
  beforeEach(() => setOrg.mockReset());

  it('accepts cloud-only limits', async () => {
    const { acuCommand } = await import('../src/cli/commands/acu.js');
    const program = new Command('devin-admin');
    program.addCommand(acuCommand());

    await program.parseAsync(['node', 'devin-admin', 'acu', 'set-org', 'Acme', '--cloud', '600']);

    expect(setOrg).toHaveBeenCalledWith('Acme', { local: undefined, cloud: 600 }, false);
  });

  it('rejects set-org when neither limit is provided', async () => {
    const { acuCommand } = await import('../src/cli/commands/acu.js');
    const program = new Command('devin-admin');
    program.addCommand(acuCommand());

    await expect(program.parseAsync(['node', 'devin-admin', 'acu', 'set-org', 'Acme'])).rejects.toThrow(
      'Provide at least one of --local or --cloud'
    );
    expect(setOrg).not.toHaveBeenCalled();
  });
});
