import posthog from "posthog-js";
import { browser } from "$app/environment";
import { PUBLIC_POSTHOG_KEY } from "$env/static/public";

export const load = async () => {
  if (browser) {
    posthog.init(PUBLIC_POSTHOG_KEY, {
      api_host: "https://t.app.rosace.app",
      defaults: "2026-01-30",
    });
  }
};
