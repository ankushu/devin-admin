export function requireAtLeastOne(
  options: Record<string, unknown>,
  names: string[],
  message = `Provide at least one of ${formatNames(names, 'or')}`
): void {
  if (!names.some((name) => hasValue(options[name]))) throw new Error(message);
}

export function requireTogether(
  options: Record<string, unknown>,
  names: string[],
  message = `Options ${formatNames(names)} must be provided together`
): void {
  const provided = names.filter((name) => hasValue(options[name])).length;
  if (provided > 0 && provided < names.length) throw new Error(message);
}

export function requireMutuallyExclusive(
  options: Record<string, unknown>,
  names: string[],
  message = `Options ${formatNames(names)} are mutually exclusive`
): void {
  if (names.filter((name) => hasValue(options[name])).length > 1) throw new Error(message);
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '');
}

function formatNames(names: string[], separator: 'and' | 'or' = 'and'): string {
  return names.map((name) => `--${name}`).join(` ${separator} `);
}
