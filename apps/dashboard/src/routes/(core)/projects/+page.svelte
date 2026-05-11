<script lang="ts">
  import { liveQuery } from "dexie";
  import { db } from "$lib/db";
  import posthog from "posthog-js";
  import Stage from "$lib/components/Stage.svelte";

  let { data } = $props();
  let projects = liveQuery(() => db.projects.toArray());
</script>

{#if data.waitlist}
  <Stage />
{:else}
  <div>
    Logged in as {data.user.email} and have {($projects || []).length} projects.
  </div>
{/if}

<form
  class="absolute top-5 right-8 z-50"
  method="POST"
  onsubmit={() => posthog.reset()}
>
  <button type="submit">Sign out</button>
</form>
