<script lang="ts">
  import { db } from "$lib/db";
  import { liveQuery } from "dexie";

  let { data } = $props();

  let projects = $derived(liveQuery(() => db.projects.toArray()));
</script>

<div>
  you're logged in as {data.user.email} and you have {projects.subscribe(
    (p) => p.length,
  )} projects
</div>
