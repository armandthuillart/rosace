// import { emailOTP } from "better-auth/plugins";

// import { convex } from "../../better-auth/src/plugin";
// import { defineAuth } from "./_crpc";
// import { internal } from "./_generated/api";
// import { DAY } from "./constants";
// import { getEnv } from "./env";

// export default defineAuth((ctx) => {
//   const env = getEnv();

//   return {
//     account: {
//       accountLinking: {
//         allowDifferentEmails: true,
//         enabled: true,
//         trustedProviders: ["apple", "email-password", "google"],
//         updateUserInfoOnLink: true,
//       },
//     },
//     baseURL: env.DASHBOARD_URL,
//     emailAndPassword: {
//       enabled: true,
//     },
//     emailVerification: {
//       autoSignInAfterVerification: true,
//     },
//     plugins: [
//       convex(),
//       emailOTP({
//         overrideDefaultEmailVerification: true,
//         async sendVerificationOTP({ email, otp, type }) {
//           if (type === "forget-password") {
//             await ctx.scheduler.runAfter(0, internal.email.resetPassword, {
//               otp,
//               to: email,
//             });
//             return;
//           }

//           if (type === "change-email") {
//             await ctx.scheduler.runAfter(0, internal.email.changeEmail, {
//               otp,
//               to: email,
//             });
//             return;
//           }

//           if (type === "sign-in") {
//             await ctx.scheduler.runAfter(0, internal.email.sendOtp, {
//               otp,
//               to: email,
//             });
//           }
//         },
//       }),
//     ],
//     session: {
//       expiresIn: DAY * 30,
//       updateAge: DAY * 15,
//     },
//     socialProviders: {
//       apple: {
//         clientId: env.APPLE_CLIENT_ID,
//         clientSecret: env.APPLE_CLIENT_SECRET,
//       },
//       google: {
//         accessType: "offline",
//         clientId: env.GOOGLE_CLIENT_ID,
//         clientSecret: env.GOOGLE_CLIENT_SECRET,
//         prompt: "select_account consent",
//       },
//     },
//     telemetry: {
//       enabled: false,
//     },
//     trustedOrigins: [env.DASHBOARD_URL, "https://appleid.apple.com"],
//     user: {
//       changeEmail: {
//         enabled: true,
//       },
//       deleteUser: {
//         enabled: true,
//       },
//     },
//   };
// });
