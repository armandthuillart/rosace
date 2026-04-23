<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<form method="POST">
  {#if form?.missing}<p class="error">All fields are required</p>{/if}
  {#if form?.incorrect}<p class="error">Could not create account</p>{/if}

  <label>
    First name
    <input name="firstName" type="text" value={form?.firstName ?? ""} />
  </label>

  <label>
    Last name
    <input name="lastName" type="text" value={form?.lastName ?? ""} />
  </label>

  <label>
    Email
    <input name="email" type="email" value={form?.email ?? ""} />
  </label>

  <label>
    Password
    <input name="password" type="password" />
  </label>

  <button type="submit">Register</button>
</form>

<p>
  Already have an account?
  <a href={resolve("/login")}>Log in</a>
</p>
