import adapter from "@sveltejs/adapter-cloudflare";
import type { Config } from "@sveltejs/kit";

export default {
  kit: {
    adapter: adapter(),
    csrf: {
      trustedOrigins: ["https://appleid.apple.com"],
    },
  },
} satisfies Config;
