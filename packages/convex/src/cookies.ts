export function clear(type: "handoff" | "session") {
  if (type === "handoff") {
    return "session:handoff=; Path=/auth/session/claim; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  }
  return "session:token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export function read(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const cookies: Record<string, string> = {};

  for (const part of header.split(";")) {
    const i = part.indexOf("=");
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
