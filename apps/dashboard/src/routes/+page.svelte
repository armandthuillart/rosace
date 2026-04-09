<script lang="ts">
  import { useAuth } from "@repo/crpc/svelte";

  let { data } = $props();

  const auth = useAuth();
</script>
