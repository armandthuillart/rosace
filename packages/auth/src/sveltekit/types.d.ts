import type { Auth, User } from "./types";

declare module "@sveltejs/kit" {
  interface Locals {
    auth: () => Promise<Auth>;
  }
  interface PageData {
    user: User | null;
  }
}
