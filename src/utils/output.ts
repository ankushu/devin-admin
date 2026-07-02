import Table from 'cli-table3';

export function renderJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function renderTable(
  rows: Record<string, unknown>[],
  columns: string[],
  headers?: string[]
): void {
  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }

  const table = new Table({
    head: headers ?? columns,
    style: { head: ['cyan'] },
  });

  for (const row of rows) {
    table.push(columns.map((col) => formatCell(row[col])));
  }

  console.log(table.toString());
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

export function renderKV(pairs: [string, unknown][]): void {
  const maxKey = Math.max(...pairs.map(([k]) => k.length));
  for (const [k, v] of pairs) {
    const label = k.padEnd(maxKey);
    const val = v === undefined || v === null ? '—' : String(v);
    console.log(`  ${label}  ${val}`);
  }
}

export function renderDryRun(method: string, path: string, body?: unknown): void {
  console.log('[dry-run]', method, path);
  if (body !== undefined) {
    console.log('  body:', JSON.stringify(body, null, 2));
  }
}
