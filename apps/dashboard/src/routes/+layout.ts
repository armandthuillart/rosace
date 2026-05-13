import { browser } from '$app/environment';
import { PUBLIC_POSTHOG_KEY, PUBLIC_POSTHOG_HOST } from '$env/static/public';
import posthog from 'posthog-js';

import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
  if (browser) {
    posthog.init(PUBLIC_POSTHOG_KEY, { api_host: PUBLIC_POSTHOG_HOST, defaults: '2026-01-30' });
  }
  return { user: data.user };
};
