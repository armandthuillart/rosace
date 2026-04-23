import { redirect, type RequestEvent } from "@sveltejs/kit";

const logout = async (event: RequestEvent) => {
  const headers = new Headers();
  const origin = event.request.headers.get("origin");

  if (origin) headers.set("origin", origin);

  await event.fetch("/auth/logout", {
    headers,
    method: "POST",
  });

  redirect(303, "/login");
};

export { logout };
