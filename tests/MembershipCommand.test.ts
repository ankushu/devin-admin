import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

const removeOrg = vi.fn();
const question = vi.fn();
const close = vi.fn();

vi.mock('../src/container.js', () => ({
  buildContainer: () => ({
    membershipService: { removeOrg },
  }),
}));

vi.mock('node:readline/promises', () => ({
  createInterface: () => ({
    question,
    close,
  }),
}));

describe('membership CLI remove command', () => {
  beforeEach(() => {
    removeOrg.mockReset();
    question.mockReset();
    close.mockReset();
  });

  it('wires confirmation callback and proceeds only after explicit yes', async () => {
    removeOrg.mockImplementation(async (_user: string, _org: string, opts: { confirm: (message: string) => Promise<boolean> }) => {
      const confirmed = await opts.confirm('Proceed with removal? Type "yes" to continue: ');
      return { removed: confirmed };
    });
    question.mockResolvedValue('yes');

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { membershipCommand } = await import('../src/cli/commands/membership.js');
    const program = new Command('devin-admin');
    program.option('--json').option('--dry-run');
    program.addCommand(membershipCommand());

    await program.parseAsync(['node', 'devin-admin', 'membership', 'remove', 'alice@example.com', '--org', 'Target']);

    expect(removeOrg).toHaveBeenCalledTimes(1);
    expect(removeOrg).toHaveBeenCalledWith(
      'alice@example.com',
      'Target',
      expect.objectContaining({ dryRun: false, confirm: expect.any(Function) })
    );
    expect(question).toHaveBeenCalledWith('Proceed with removal? Type "yes" to continue: ');
    expect(close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Removed alice@example.com from org Target.');
    log.mockRestore();
  });
});
