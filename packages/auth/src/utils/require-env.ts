function requireEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} must be set for auth to work.`);
  }

  return value;
}

export { requireEnv };
