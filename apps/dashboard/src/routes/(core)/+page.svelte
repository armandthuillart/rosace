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

<form method="POST">
  <button type="submit">Sign out</button>
</form>
