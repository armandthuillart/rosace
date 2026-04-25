declare global {
  namespace App {
    interface Locals {
      // @ts-ignore
      auth: () => Promise<Auth>;
    }
    interface PageData {
      user: User | null;
    }
  }
}

// @ts-ignore
declare module "$env/dynamic/private" {
  export const env: {
    CONVEX_SITE_URL: string;
  };
}

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: "free" | "pro";
  verified: boolean;
};

export type Auth = {
  user: User;
} | null;
