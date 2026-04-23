<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ActionData } from "./$types.js";

  let { form }: { form: ActionData } = $props();
</script>

<form method="POST">
  {#if form?.missing}<p class="error">The email field is required</p>{/if}
  {#if form?.incorrect}<p class="error">Invalid credentials!</p>{/if}

  <label>
    Email
    <input
      name="email"
      type="email"
      autocomplete="email"
      required
      value={form?.email ?? ""}
    />
  </label>

  <label>
    Password
    <input
      name="password"
      type="password"
      autocomplete="current-password"
      required
    />
  </label>

  <button type="submit">Log in</button>
</form>

<p>
  No account?
  <a href={resolve("/register")}>Register</a>
</p>
