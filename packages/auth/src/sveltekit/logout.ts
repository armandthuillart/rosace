import { redirect, RequestEvent } from "@sveltejs/kit";

const logout = async (event: RequestEvent) => {
  await event.fetch("/auth/logout", { method: "POST" });
  throw redirect(303, "/login");
};

export { logout };
