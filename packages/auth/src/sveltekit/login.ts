import { fail, redirect, type RequestEvent } from "@sveltejs/kit";

const login = async (event: RequestEvent) => {
  const data = await event.request.formData();

  const email = String(data.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(data.get("password") ?? "");
  const lastName = String(data.get("lastName") ?? "").trim();
  const firstName = String(data.get("firstName") ?? "").trim();

  const register = Boolean(firstName || lastName);
  const missing = !email || !password || (register && (!firstName || !lastName));

  if (missing) {
    return fail(400, {
      email,
      missing: true,
      lastName,
      firstName,
    });
  }

  const headers = new Headers({ "content-type": "application/json" });
  const origin = event.request.headers.get("origin");
  if (origin) headers.set("origin", origin);

  const response = await event.fetch("/auth/login/credentials", {
    body: JSON.stringify({
      email,
      password,
      lastName: lastName || undefined,
      firstName: firstName || undefined,
    }),
    method: "POST",
    headers,
  });

  if (!response.ok) {
    return fail(400, {
      email,
      lastName,
      firstName,
      incorrect: true,
    });
  }

  redirect(303, "/");
};

export { login };
