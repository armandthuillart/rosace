type Options =
  | { provider: "credentials"; password: string }
  | { provider: "google" }
  | { provider: "apple" };

function signIn(options: Options) {
  const { provider } = options;

  if (provider === "credentials") {
    const { password } = options;
    // TODO: Implement credentials sign in
  }

  if (provider === "google") {
    // TODO: Implement Google sign in
  }

  if (provider === "apple") {
    // TODO: Implement Apple sign in
  }
}

export { signIn };
