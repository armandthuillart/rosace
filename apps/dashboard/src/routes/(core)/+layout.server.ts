import { redirect } from "@sveltejs/kit";
import { PostHog } from "posthog-node";
import { PUBLIC_POSTHOG_KEY } from "$env/static/public";

import type { LayoutServerLoad } from "./$types";

const posthog = new PostHog(PUBLIC_POSTHOG_KEY);

export const load: LayoutServerLoad = async ({ parent }) => {
  const data = await parent();
  if (!data.user) throw redirect(302, "/");
  const flags = await posthog.evaluateFlags(data.user._id);
  return { user: data.user, waitlist: !flags.isEnabled("early-access") };
};
