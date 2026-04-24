type SocialProvider = "google" | "apple";
type Provider = SocialProvider | "credentials";

type SocialProviderConfig = { name: SocialProvider };
type ConvexAuthConfig = { socialProviders?: SocialProviderConfig[] };

export type { ConvexAuthConfig, Provider, SocialProvider, SocialProviderConfig };
