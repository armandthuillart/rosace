<script>
  import { resolve } from "$app/paths";
</script>

<form method="POST">
  <input type="hidden" name="provider" value="credentials" />
  <label>Email <input name="email" type="email" /></label>
  <label>Password <input name="password" type="password" /></label>
  <button type="submit">Log in</button>
</form>

<p>
  No account?
  <a href={resolve("/register")}>Register</a>
</p>
