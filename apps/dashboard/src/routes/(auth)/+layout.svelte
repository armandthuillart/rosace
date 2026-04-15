<script lang="ts">
  import { signIn } from "$lib/auth";
  import { capitalize } from "$lib/utils";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();

  let providers = ["google", "apple"] as const;
</script>

<div class="p-4 flex h-screen">
  <div class="m-auto max-w-xs space-y-5">
    <h1 class="text-3xl text-center font-medium">Login or sign up</h1>

    <p class="mb-4 text-center">
      You’ll get smarter responses and can upload files, images, and more.
    </p>

    {#each providers as provider}
      <button
        class="mb-3 w-full inline-flex gap-2 items-center justify-center h-13 rounded-full font-medium border border-border hover:bg-muted"
        onclick={() => signIn.social({ provider })}
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
