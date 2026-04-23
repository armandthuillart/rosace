<script>
  import { resolve } from "$app/paths";
  import { login } from "$lib/auth";

  let email = $state("");
  let password = $state("");
</script>

<div>
  <input type="email" bind:value={email} />
  <input type="password" bind:value={password} />
  <button onclick={() => login("credentials", { email, password })}
    >Log in</button
  >
</div>

<p>
  No account?
  <a href={resolve("/register")}>Register</a>
</p>
