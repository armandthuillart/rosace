<script lang="ts">
  import { capitalize } from "@repo/helpers";
  import type { LayoutProps } from "./$types";
  import { PUBLIC_MARKETING_URL } from "$env/static/public";
  import Icon from "$lib/components/Icon.svelte";

  let { children }: LayoutProps = $props();

  let providers = ["google", "apple"] as const;
</script>

<div class="flex h-screen items-center justify-center p-4">
  <div class="flex max-w-90 flex-col items-center gap-15">
    <a
      aria-label="Go back home"
      class="flex items-center gap-2 transition-opacity duration-200 hover:opacity-80"
      href={PUBLIC_MARKETING_URL}
    >
      <Icon class="size-10" name="rosace" />
      <span class="text-2xl/10 font-bold">Rosace</span>
    </a>

    <div class="flex flex-col">
      <h1 class="text-center text-3xl font-medium">Login or sign up</h1>

      <p class="mb-4 text-center">
        You’ll get smarter responses and can upload files, images, and more.
      </p>

      {#each providers as provider}
        <a
          class="border-border hover:bg-muted mb-3 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border font-medium"
          href={`/auth/login/${provider}`}
        >
          <Icon
            class={["size-5", provider === "apple" && "fill-foreground"]}
            name={provider}
          />
          Continue with {capitalize(provider)}
        </a>
      {/each}

      {@render children()}
    </div>
  </div>
</div>
