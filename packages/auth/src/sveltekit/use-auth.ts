import { handle } from "./handle";
import { signIn } from "./sign-in";
import { signOut } from "./sign-out";
import { signUp } from "./sign-up";

function useAuth() {
  return { handle, signIn, signUp, signOut };
}

export { useAuth };
