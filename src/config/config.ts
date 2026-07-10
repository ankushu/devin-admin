import { config } from 'dotenv';
import { z } from 'zod';

config();

const ConfigSchema = z.object({
  DEVIN_API_TOKEN: z.string().min(1, 'DEVIN_API_TOKEN is required'),
  DEVIN_API_BASE_URL: z.string().url('DEVIN_API_BASE_URL must be a valid URL'),
  ORG_CACHE_PATH: z.string().default('./data/orgs.json'),
  BILLING_CYCLE_START_DAY: z.coerce.number().min(1).max(31).default(18),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Configuration error:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  _config = result.data;
  return _config;
}
