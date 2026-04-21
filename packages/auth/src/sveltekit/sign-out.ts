import { redirect, RequestEvent } from "@sveltejs/kit";

const signOut = async (event: RequestEvent) => {
  await event.fetch("/auth/sign-out", { method: "POST" });
  throw redirect(303, "/login");
};

export { signOut };
