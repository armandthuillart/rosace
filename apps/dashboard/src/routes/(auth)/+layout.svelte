<script lang="ts">
  import { capitalize } from "$lib/utils";
  import type { LayoutProps } from "./$types";
  import { PUBLIC_MARKETING_URL } from "$env/static/public";

  let { children }: LayoutProps = $props();

  let providers = ["google", "apple"] as const;
</script>

<div class="flex h-screen p-4">
  <div class="m-auto max-w-xs space-y-5">
    <a aria-label="Go back home" href={PUBLIC_MARKETING_URL}>
      <svg class="size-16">
        <use href="/sprites.svg#rosace"></use>
      </svg>
    </a>

    <h1 class="text-center text-3xl font-medium">Login or sign up</h1>

    <p class="mb-4 text-center">
      You’ll get smarter responses and can upload files, images, and more.
    </p>

    {#each providers as provider}
      <a
        class="border-border hover:bg-muted mb-3 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border font-medium"
        href={`/auth/login/${provider}`}
      >
        <svg class={["size-5", provider === "apple" && "fill-foreground"]}>
          <use href="/sprites.svg#{provider}"></use>
        </svg>
        Continue with {capitalize(provider)}
      </a>
    {/each}

    {@render children()}
  </div>
</div>
