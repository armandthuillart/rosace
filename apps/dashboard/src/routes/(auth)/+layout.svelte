<script lang="ts">
  import { signIn } from "$lib/auth";
  import { capitalize } from "$lib/utils";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();

  let providers = ["google", "apple"] as const;
</script>

<div class="flex h-screen p-4">
  <div class="m-auto max-w-xs space-y-5">
    <h1 class="text-center text-3xl font-medium">Login or sign up</h1>

    <p class="mb-4 text-center">
      You’ll get smarter responses and can upload files, images, and more.
    </p>

    {#each providers as provider}
      <button
        class="border-border hover:bg-muted mb-3 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border font-medium"
        onclick={() => signIn({ provider })}
      >
        <svg class={["size-5", provider === "apple" && "fill-foreground"]}>
          <use href="/sprites.svg#{provider}"></use>
        </svg>
        Continue with {capitalize(provider)}
      </button>
    {/each}

    {@render children()}
  </div>
</div>
