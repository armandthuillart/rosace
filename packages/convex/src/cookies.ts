type HandoffArgs = { code: string };
type SessionArgs = { sessionToken: string; expiresAt: number };

export function list(type: 'handoff', args: HandoffArgs): string;
export function list(type: 'session', args: SessionArgs): string;
export function list(type: 'handoff' | 'session', args: HandoffArgs | SessionArgs): string {
  if ('code' in args) {
    return `session:handoff=${args.code}; Path=/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=60`;
  }
  const maxAgeSession = Math.max(1, Math.floor((args.expiresAt - Date.now()) / 1000));
  return `session:token=${args.sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSession}`;
}

export function clear(type: 'handoff' | 'session') {
  if (type === 'handoff') {
    return 'session:handoff=; Path=/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
  }
  return 'session:token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export function read(request: Request) {
  const header = request.headers.get('cookie') ?? '';
  const cookies: Record<string, string> = {};

  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;

    const key = part.slice(0, i).trim();
    if (!key) continue;

    const value = part.slice(i + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      continue;
    }
  }

  return cookies;
}
