import { login } from "./login";
import { logout } from "./logout";
import { handle } from "./handle";

function svelteAuth() {
  return { handle, login, logout };
}

export { svelteAuth };
