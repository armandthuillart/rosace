import { RequestEvent } from "@sveltejs/kit";

function requireEnv(key: string): string;
function requireEnv(key: string, event: RequestEvent): string;
function requireEnv(key: string, event?: RequestEvent): string {
  const value = event
    ? event.platform?.env?.[key as keyof typeof event.platform.env]
    : process.env[key];

  if (!value) {
    throw new Error(`${key} is missing and must be set.`);
  }

  return String(value);
}

export { requireEnv };
