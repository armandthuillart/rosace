import { readJWKS } from "./store";

function getAuth() {
  const jwks = readJWKS();

  if (jwks) {
    return { isAuthenticated: true };
  }

  return { isAuthenticated: false };
}

export { getAuth };
