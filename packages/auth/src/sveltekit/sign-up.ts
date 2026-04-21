import { fail, redirect, RequestEvent } from "@sveltejs/kit";
import * as v from "valibot";

const FormSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
  lastName: v.pipe(v.string(), v.trim(), v.minLength(1)),
  firstName: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

const signUp = async (event: RequestEvent) => {
  const raw = await event.request.formData();
  const parsed = v.safeParse(FormSchema, raw);

  if (!parsed.success) {
    return fail(400, {
      error: "",
      email: "",
      lastName: "",
      firstName: "",
    });
  }

  const res = await event.fetch("/auth/sign-up", {
    body: JSON.stringify(parsed.output),
    method: "POST",
    headers: { "content-type": "application/json" },
  });

  if (res.status === 409) {
    return fail(409, {
      error: "",
      email: parsed.output.email,
      lastName: parsed.output.lastName,
      firstName: parsed.output.firstName,
    });
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error: string;
    };

    return fail(res.status, {
      error: "",
      email: parsed.output.email,
      lastName: parsed.output.lastName,
      firstName: parsed.output.firstName,
    });
  }

  throw redirect(303, "/");
};

export { signUp };
