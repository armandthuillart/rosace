import { GenericId } from "convex/values";

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
  _id: GenericId<"users">;
  _creationTime: number;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  plan: "free" | "pro";
};

type Session = {
  user: User;
  token: string;
  expiresAt: number;
} | null;

export type { Session, User };
