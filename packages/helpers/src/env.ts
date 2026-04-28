export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is missing and must be set.`);
  return value;
}
