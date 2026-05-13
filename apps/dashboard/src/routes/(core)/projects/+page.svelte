<script lang="ts">
  import { liveQuery } from "dexie";
  import { db } from "$lib/db";
  import posthog from "posthog-js";
  import Cards from "$lib/components/Cards.svelte";

  let { data } = $props();
  let projects = liveQuery(() => db.projects.toArray());
</script>

{#if data.waitlist}
  <Cards />

  <form
    class="absolute top-5 right-8"
    method="POST"
    onsubmit={() => posthog.reset()}
  >
    <button
      class="bg-primary hover:bg-primary/80 text-primary-foreground flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold transition-colors duration-200"
      type="submit">Sign out</button
    >
  </form>
{:else}
  <div>
    Logged in as {data.user.email} and have {($projects || []).length} projects.
  </div>
{/if}
