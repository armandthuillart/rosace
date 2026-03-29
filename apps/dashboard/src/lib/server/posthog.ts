import { env } from "$env/dynamic/public";
import { PostHog } from "posthog-node";

let posthog: PostHog | null = null;

export function getPostHog() {
  if (!env.PUBLIC_POSTHOG_API_KEY) {
    throw new Error("PUBLIC_POSTHOG_PROJECT_TOKEN is required for PostHog server events.");
  }

  if (!posthog) {
    posthog = new PostHog(env.PUBLIC_POSTHOG_API_KEY, {
      host: env.PUBLIC_POSTHOG_HOST,
    });
  }

  return posthog;
}
