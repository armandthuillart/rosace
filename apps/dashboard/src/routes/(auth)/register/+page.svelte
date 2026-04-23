<script>
  import { resolve } from "$app/paths";
  import { login } from "$lib/auth";

  let firstName = $state("");
  let lastName = $state("");
  let email = $state("");
  let password = $state("");
</script>

<div>
  <input type="text" bind:value={firstName} />
  <input type="text" bind:value={lastName} />
  <input type="email" bind:value={email} />
  <input type="password" bind:value={password} />
  <button
    onclick={() =>
      login("credentials", { email, firstName, lastName, password })}
    >Register</button
  >
</div>

<p>
  Already have an account?
  <a href={resolve("/login")}>Log in</a>
</p>
