<script lang="ts">
  let { data } = $props();
</script>

<div>you're logged in as {data.user?.email}</div>
