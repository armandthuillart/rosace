import { readToken } from "./store";

function getAuth() {
  const token = readToken();

  if (token) {
    return { isAuthenticated: true };
  }

  return { isAuthenticated: false };
}

export { getAuth };
