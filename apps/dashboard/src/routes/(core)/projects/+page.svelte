<script lang="ts">
  import { liveQuery } from "dexie";
  import { db } from "$lib/db";
  import Cards from "$lib/components/Cards.svelte";

  let { data } = $props();
  let projects = liveQuery(() => db.projects.toArray());
</script>

{#if data.waitlist}
  <Cards />
{:else}
  <div>
    Logged in as {data.user.email} and have
    {#if $projects === undefined}
      <span>…</span>
    {:else}
      {$projects.length}
    {/if}
    projects.
  </div>
{/if}
