function requireEnv(
  key: "CONVEX_URL" | "CONVEX_SITE_URL" | "JWKS" | "AUTH_SECRET" | "DASHBOARD_URL",
) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is missing and must be set.`);
  }

  return value;
}

export { requireEnv };
