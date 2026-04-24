import { createHandle } from "./handle";
import { login } from "./login";
import { logout } from "./logout";

type SvelteAuthConfig = {
  convexSiteUrl: string;
};

function svelteAuth({ convexSiteUrl }: SvelteAuthConfig) {
  return { handle: createHandle(convexSiteUrl), login, logout };
}

export { svelteAuth };
export type { SvelteAuthConfig };
