declare global {
  namespace App {
    interface Locals {
      auth: () => Promise<Session>;
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

export type Session = {
  user: User;
  token: string;
  expires: number;
} | null;
