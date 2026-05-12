import type { KnipConfig } from 'knip';

export default {
  svelte: { config: ['svelte.config.ts'] },
  sveltekit: { config: ['svelte.config.ts'] },
  workspaces: {
    'packages/svelte': { entry: ['src/**'] },
    'packages/convex': { entry: ['src/**'] },
  },
  ignoreUnresolved: ['\\$app/environment', '\\$env/dynamic/private', '\\$env/dynamic/public'],
} satisfies KnipConfig;
