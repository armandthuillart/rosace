import { file, write } from 'bun';

function parseEnv(content: string) {
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }

  return env;
}

const root = new URL('../', import.meta.url);

const envs = {
  dev: parseEnv(await file(new URL('.env.development', root)).text()),
  prod: parseEnv(await file(new URL('.env.production', root)).text()),
};

const KEYS = {
  dashboard: [
    'CONVEX_SITE_URL',
    'CONVEX_URL',
    'DASHBOARD_URL',
    'MARKETING_URL',
    'POSTHOG_KEY',
    'POSTHOG_HOST',
  ],
  marketing: ['DASHBOARD_URL', 'MARKETING_URL'],
} as const;

const targets: Array<{
  file: string;
  from: 'dev' | 'prod';
  keys: readonly string[];
  prefix: Record<string, string>;
}> = [
  {
    file: 'apps/dashboard/.env.development',
    from: 'dev',
    keys: KEYS.dashboard,
    prefix: {
      CONVEX_URL: 'PUBLIC_',
      MARKETING_URL: 'PUBLIC_',
      POSTHOG_KEY: 'PUBLIC_',
      POSTHOG_HOST: 'PUBLIC_',
    },
  },
  {
    file: 'apps/dashboard/.env.production',
    from: 'prod',
    keys: KEYS.dashboard,
    prefix: {
      CONVEX_URL: 'PUBLIC_',
      MARKETING_URL: 'PUBLIC_',
      POSTHOG_KEY: 'PUBLIC_',
      POSTHOG_HOST: 'PUBLIC_',
    },
  },
  {
    file: 'apps/marketing/.env.development',
    from: 'dev',
    keys: KEYS.marketing,
    prefix: {},
  },
  {
    file: 'apps/marketing/.env.production',
    from: 'prod',
    keys: KEYS.marketing,
    prefix: {},
  },
] as const;

for (const { file, from, keys, prefix } of targets) {
  const content =
    keys.map((key) => `${prefix[key] ?? ''}${key}=${envs[from][key] ?? ''}`).join('\n') + '\n';

  await write(new URL(file, root), content);
}

const files = targets.map((t) => t.file);

console.info('¤ Preparing environment files\n');
for (const file of files) console.info(`- ${file}`);
console.info(`\n✓ Prepared ${files.length} environment files`);
