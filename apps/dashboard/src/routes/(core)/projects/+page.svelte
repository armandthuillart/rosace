<script lang="ts">
  import { liveQuery } from "dexie";
  import { db } from "$lib/db";

  let { data } = $props();
  let projects = liveQuery(() => db.projects.toArray());
</script>

{#if data.waitlist}
  <div>We'll let you know when you get early access.</div>
{:else}
  <div>
    Logged in as {data.user.email} and have {($projects || []).length} projects.
  </div>
{/if}

<form method="POST">
  <button type="submit">Sign out</button>
</form>
