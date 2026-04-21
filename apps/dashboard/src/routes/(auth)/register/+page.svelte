<script>
  import { resolve } from "$app/paths";
</script>

<form method="POST">
  <label>
    Email
    <input name="email" type="email" />
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
