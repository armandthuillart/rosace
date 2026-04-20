import { handle } from "./handle";
import { signIn } from "./sign-in";
import { signOut } from "./sign-out";

function useAuth() {
  return { handle, signIn, signOut };
}

export { useAuth };
