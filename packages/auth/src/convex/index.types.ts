import { GenericId } from "convex/values";

type Account = {
  _id: GenericId<"accounts">;
  _creationTime: number;
  userId: GenericId<"users">;
  provider: "credentials" | "apple" | "google";
  accountId: string;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  refreshToken: string | null;
  password: string | null;
};

type Verification = {
  _id: GenericId<"verifications">;
  _creationTime: number;
  identifier: string;
  value: string;
  expiresAt: number;
};

export type { Account, Verification };
