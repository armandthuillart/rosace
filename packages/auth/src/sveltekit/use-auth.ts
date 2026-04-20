import { getUser } from "./get-user";
import { handle } from "./handle";
import { signIn } from "./sign-in";
import { signOut } from "./sign-out";

function useAuth() {
  return { handle, getUser, signIn, signOut };
}

export { useAuth };
