import { GenericId } from "convex/values";

type Account = {
  _id: GenericId<"accounts">;
  _creationTime: number;
  userId: GenericId<"users">;
  provider: "apple" | "google";
  accountId: string;
};

type Verification = {
  _id: GenericId<"verifications">;
  _creationTime: number;
  identifier: string;
  value: string;
  expiresAt: number;
};

export type { Account, Verification };
