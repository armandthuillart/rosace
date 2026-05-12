import type { GenericId } from 'convex/values';

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
  _id: GenericId<'users'>;
  _creationTime: number;
  email: string;
  firstName: string;
  lastName: string;
  plan: 'free' | 'pro';
};

type Auth = {
  user: User;
  token: string;
  expiresAt: number;
} | null;

export type { Auth, User };
