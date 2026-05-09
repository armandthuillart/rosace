<script lang="ts">
  import { capitalize } from "@repo/helpers";
  import { PUBLIC_MARKETING_URL } from "$env/static/public";
  import Icon from "$lib/components/Icon.svelte";

  let providers = ["google", "apple"] as const;
</script>

<div
  class="grid min-h-dvh grid-cols-[minmax(0,25rem)] grid-rows-[min-content_min-content_24px] flex-col content-between items-center justify-center p-4"
>
  <div class="row-start-2 flex w-full flex-col items-center gap-6 pt-4 pb-16">
    <div class="flex flex-col items-center gap-4">
      <a
        aria-label="Go back home"
        class="group flex size-12 items-center justify-center transition-opacity duration-200 hover:opacity-80"
        href={PUBLIC_MARKETING_URL}
      >
        <Icon class="size-full" name="rosace" />
      </a>

      <h1 class="text-2xl font-bold">Log in or sign up</h1>
    </div>

    <div class="flex w-full flex-col gap-3">
      {#each providers as provider}
        <a
          class="bg-muted hover:bg-secondary flex h-15 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold transition-colors duration-200"
          href={`/auth/login/${provider}`}
        >
          <Icon
            class={["size-6", provider === "apple" && "fill-foreground"]}
            name={provider}
          />
          Continue with {capitalize(provider)}
        </a>
      {/each}
    </div>
  </div>

  <div
    class="text-muted-foreground row-start-3 place-self-end text-center text-balance"
  >
    By continuing, you agree to our <a
      class="text-foreground after:bg-accent hover:text-accent dark:after:bg-accent dark:hover:text-accent relative font-medium whitespace-nowrap outline-hidden transition duration-200 after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:translate-y-px after:rounded-xs after:transition after:duration-200 after:content-['']"
      href={`${PUBLIC_MARKETING_URL}/terms-of-service`}>Terms</a
    >
    and
    <a
      class="text-foreground after:bg-accent hover:text-accent dark:after:bg-accent dark:hover:text-accent relative font-medium whitespace-nowrap outline-hidden transition duration-200 after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:translate-y-px after:rounded-xs after:transition after:duration-200 after:content-['']"
      href={`${PUBLIC_MARKETING_URL}/privacy-policy`}>Privacy Policy</a
    >.
  </div>
</div>
