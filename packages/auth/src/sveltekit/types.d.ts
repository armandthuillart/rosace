type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: "free" | "pro";
  verified: boolean;
};

type Session = {
  id: string;
  userId: string;
  expiresAt: number;
};

type Auth = {
  user: User;
  session: Session;
};

declare module "@sveltejs/kit" {
  interface Locals {
    auth: () => Promise<Auth | null>;
  }
  interface PageData {
    user: User | null;
  }
}
