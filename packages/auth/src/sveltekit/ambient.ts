import type { Auth, User } from "./types";

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

export {};
