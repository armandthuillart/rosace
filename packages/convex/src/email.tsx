import { Resend } from "@convex-dev/resend";
import { render } from "@react-email/render";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { Welcome } from "./email.template";
import { env } from "./env";
import { convex } from "./middleware";

const resend = new Resend(components.resend, {
  testMode: env.DEPLOY_ENV !== "production",
});

const from = "Rosace <contact@mail.rosace.app>";

export const sendWelcomeEmail = convex
  .action()
  .input(
    v.object({
      to: v.string(),
      firstName: v.string(),
    }),
  )
  .returns(v.string())
  .handler(async (ctx, input) => {
    let { to } = input;

    if (env.DEPLOY_ENV !== "production") {
      to = "delivery@resend.dev";
    }

    const html = await render(<Welcome firstName={input.firstName} />);

    const emailId = await resend.sendEmail(ctx, {
      from,
      html,
      subject: "Welcome to Rosace!",
      to,
    });

    return emailId;
  })
  .internal();
