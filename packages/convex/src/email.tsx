import { Resend } from "@convex-dev/resend";
import { render } from "@react-email/render";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { convex } from "./crpc";
import { OTP } from "./emails/otp";
import { getEnv } from "./env";

const env = getEnv();

const resend = new Resend(components.resend, {
  testMode: env.DEPLOY_ENV !== "production",
});

let from = "Rosace <contact@mail.rosace.app>";

if (env.DEPLOY_ENV === "production") {
  from = "Rosace <contact@mail.rosace.app>";
}

export const resetPassword = convex
  .action()
  .input(
    v.object({
      otp: v.string(),
      to: v.string(),
    }),
  )
  .returns(v.string())
  .handler(async (ctx, input) => {
    let { to } = input;

    if (env.DEPLOY_ENV !== "production") {
      to = "delivery@resend.dev";
    }

    const html = await render(<OTP otp={input.otp} type="reset-password" />);

    const emailId = await resend.sendEmail(ctx, {
      from,
      html,
      subject: "Reset your password",
      to,
    });

    return emailId;
  })
  .internal();

export const changeEmail = convex
  .action()
  .input(
    v.object({
      otp: v.string(),
      to: v.string(),
    }),
  )
  .returns(v.string())
  .handler(async (ctx, input) => {
    let { to } = input;

    if (env.DEPLOY_ENV !== "production") {
      to = "delivery@resend.dev";
    }

    const html = await render(<OTP otp={input.otp} type="change-email" />);

    const emailId = await resend.sendEmail(ctx, {
      from,
      html,
      subject: "Change your email",
      to,
    });

    return emailId;
  })
  .internal();

export const sendOtp = convex
  .action()
  .input(
    v.object({
      otp: v.string(),
      to: v.string(),
    }),
  )
  .returns(v.string())
  .handler(async (ctx, input) => {
    let { to } = input;

    if (env.DEPLOY_ENV !== "production") {
      to = "delivery@resend.dev";
    }

    const html = await render(<OTP otp={input.otp} type="sign-in" />);

    const emailId = await resend.sendEmail(ctx, {
      from,
      html,
      subject: "Your code to sign in",
      to,
    });

    return emailId;
  })
  .internal();
