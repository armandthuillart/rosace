declare global {
  namespace App {
    interface Locals {
      auth: () => Promise<Auth>;
    }
    interface PageData {
      user: User | null;
    }
  }
}

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: "free" | "pro";
  verified: boolean;
};

type Auth = {
  user: User;
} | null;

export type { Auth, User };
