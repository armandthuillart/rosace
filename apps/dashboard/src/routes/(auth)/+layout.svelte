<script lang="ts">
  import { capitalize } from "@repo/helpers";
  import type { LayoutProps } from "./$types";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { PUBLIC_MARKETING_URL } from "$env/static/public";
  import Icon from "$lib/components/Icon.svelte";

  let { children }: LayoutProps = $props();

  let providers = ["google", "apple"] as const;
</script>

<div class="flex h-screen p-4">
  <div class="m-auto flex w-full max-w-90 flex-col items-center space-y-5">
    <a
      aria-label="Go back home"
      class="mb-15 flex items-center gap-2 transition-opacity duration-200 hover:opacity-80"
      href={PUBLIC_MARKETING_URL}
    >
      <Icon class="size-10" name="rosace" />
      <span class="text-2xl/10 font-bold">Rosace</span>
    </a>

    <h1 class="text-center text-3xl font-bold">Login or sign up</h1>

    <p class="mb-9 text-xl">
      {page.url.pathname === "/register"
        ? "Already have an account?"
        : "Don't have an account yet?"}

      <a
        class="relative font-medium whitespace-nowrap outline-hidden transition duration-200 after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:translate-y-px after:rounded-xs after:bg-blue-400 after:transition after:duration-200 after:content-[''] hover:text-blue-400 dark:after:bg-blue-500 dark:hover:text-blue-500"
        href={page.url.pathname === "/register" ? "/login" : "/register"}
      >
        {page.url.pathname === "/register" ? "Sign in" : "Sign up"}
      </a>.
    </p>

    {#each providers as provider}
      <a
        class="bg-muted hover:bg-secondary mb-3 flex h-15 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold transition-colors duration-200"
        href={`/auth/login/${provider}`}
      >
        <Icon
          class={["size-6", provider === "apple" && "fill-foreground"]}
          name={provider}
        />
        Continue with {capitalize(provider)}
      </a>
    {/each}

    <div class="my-2 flex w-full items-center gap-6">
      <hr class="border-border w-full border" />
      <div class="font-semibold uppercase">Or</div>
      <hr class="border-border w-full border" />
    </div>

    {@render children()}

    <div class="text-center">
      By continuing, you agree to our <a
        class="relative font-medium whitespace-nowrap outline-hidden transition duration-200 after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:translate-y-px after:rounded-xs after:bg-blue-400 after:transition after:duration-200 after:content-[''] hover:text-blue-400 dark:after:bg-blue-500 dark:hover:text-blue-500"
        href={`${PUBLIC_MARKETING_URL}/terms-of-service`}>Terms of Service</a
      >
      and
      <a
        class="relative font-medium whitespace-nowrap outline-hidden transition duration-200 after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:translate-y-px after:rounded-xs after:bg-blue-400 after:transition after:duration-200 after:content-[''] hover:text-blue-400 dark:after:bg-blue-500 dark:hover:text-blue-500"
        href={`${PUBLIC_MARKETING_URL}/privacy-policy`}>Privacy Policy</a
      >.
    </div>
  </div>
</div>
