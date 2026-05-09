<script lang="ts">
  import { page } from "$app/state";
</script>

<div class="flex h-screen p-4">
  <div
    class="m-auto flex w-full max-w-90 flex-col items-center space-y-5 text-center"
  >
    <h1 class="text-3xl font-bold">{page.status}</h1>
    <p>{page.error?.message ?? "Something went wrong"}</p>
    <a href="/projects" class="btn">Go to projects</a>
  </div>
</div>
