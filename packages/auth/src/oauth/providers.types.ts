export type SocialProvider = "apple" | "google";

export type OAuthProfile = {
  accountId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
};

export type ExchangeOptions = {
  code: string;
  nonce: string;
  verifier?: string;
  userForm?: string | null;
};

export type GoogleIdToken = {
  email: string;
  exp: number;
  email_verified?: boolean;
  family_name?: string;
  given_name?: string;
  iss: string;
  nonce?: string;
  sub: string;
};

export type AppleIdToken = {
  email: string;
  exp: number;
  email_verified?: boolean | "true" | "false";
  iss: string;
  nonce?: string;
  sub: string;
};

export type AppleUserForm = {
  name?: {
    firstName?: string;
    lastName?: string;
  };
};
