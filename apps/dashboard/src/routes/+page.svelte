<script lang="ts">
  import { client } from "$lib/auth";
  import { useAuth } from "@repo/convex/svelte";

  let { data } = $props();

  const auth = useAuth();
</script>