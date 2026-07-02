import { config } from 'dotenv';
import { z } from 'zod';

config();

const ConfigSchema = z.object({
  DEVIN_API_TOKEN: z.string().min(1, 'DEVIN_API_TOKEN is required'),
  DEVIN_API_BASE_URL: z.string().url().default('https://servicenow.devinenterprise.com/api'),
  ORG_CACHE_PATH: z.string().default('./data/orgs.json'),
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
