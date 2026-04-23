import { handle } from "./handle";
import { login } from "./login";
import { logout } from "./logout";

function svelteAuth() {
  return { handle, login, logout };
}

export { svelteAuth };
