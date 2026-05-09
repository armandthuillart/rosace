<script lang="ts">
  import { liveQuery } from "dexie";
  import { db } from "$lib/db";

  let { data } = $props();
  let projects = liveQuery(() => db.projects.toArray());
</script>

<div>
  Logged in as {data.user.email}. You have {($projects || []).length} projects.
</div>

<form method="POST">
  <button type="submit">Sign out</button>
</form>
