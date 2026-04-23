<script lang="ts">
  import { db } from "$lib/db";
  import { liveQuery } from "dexie";
  import { logout } from "$lib/auth";

  let { data } = $props();
  let projects = $derived(liveQuery(() => db.projects.toArray()));
</script>

<div>
  Logged in as {data.user.email}. You have {projects.subscribe((p) => p.length)} projects.
</div>

<button onclick={() => logout()}>Sign out</button>
