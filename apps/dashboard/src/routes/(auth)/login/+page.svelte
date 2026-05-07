<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();

  let showPassword = $state(false);
</script>

<form class="mt-3 flex w-full flex-col space-y-3" method="POST">
  {#if form?.missing}<p class="error">The email field is required</p>{/if}
  {#if form?.incorrect}<p class="error">Invalid credentials!</p>{/if}

  <input
    autocomplete="email"
    class="bg-muted placeholder:text-muted-foreground/70 h-15 rounded-2xl px-5 font-semibold"
    name="email"
    placeholder="Email address"
    required
    type="email"
    value={form?.email ?? ""}
  />

  <div class="relative">
    <input
      autocomplete="current-password"
      class="bg-muted placeholder:text-muted-foreground/70 h-15 w-full rounded-2xl px-5 pr-14 font-semibold"
      placeholder="Password"
      name="password"
      required
      type={showPassword ? "text" : "password"}
    />

    <button
      class="hover:bg-secondary text-muted-foreground absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg transition-colors duration-200"
      onclick={() => (showPassword = !showPassword)}
      type="button"
    >
      {#if showPassword}
        <Icon class="size-5" name="view-off-slash" />
      {:else}
        <Icon class="size-5" name="view" />
      {/if}
    </button>
  </div>

  <button
    class="bg-primary text-primary-foreground mt-5 h-15 rounded-2xl text-lg font-bold transition-opacity duration-200 hover:opacity-80"
    type="submit">Continue</button
  >
</form>


