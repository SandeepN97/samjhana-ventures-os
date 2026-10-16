# Forgotten password: what to do

No paid service is needed. Keep **at least two admin accounts**, and keep passwords in a password manager.

## Someone forgot their password (not the only admin)
1. An **admin** logs in and opens **Settings → Users**.
2. Tap **Reset password** next to the person.
3. The app shows a **temporary password once**. Give it to the person (say it out loud or send it privately).
4. The person logs in with it and is asked to **choose their own password** before doing anything else.

An admin can reset another admin. Nobody can reset their own password this way (use **Change Password**).

## The only admin forgot the password (or every admin is locked out)
This needs access to the Supabase project for that environment, so protect that login with two-step sign-in.

1. Open the **right** Supabase project (staging for staging, prod for prod) and its **SQL Editor**.
2. Make up a **new** temporary password of **12 or more characters** and put it where `<NEW-TEMPORARY-PASSWORD>` is.
   Never reuse a password from this page, from an old chat or from an example: anything written in a public place
   is the first thing an attacker tries.

   ```sql
   UPDATE users
   SET password_hash = extensions.crypt('<NEW-TEMPORARY-PASSWORD>', extensions.gen_salt('bf', 10)),
       must_change_password = true,
       is_active = true
   WHERE username = 'admin';
   ```
   (`is_active = true` also switches the account back on if the app switched it off, see the last section.)
3. Log in with the temporary password and choose a new one when asked.
4. The SQL history keeps the temporary password, so change it straight away. Old sessions end automatically.

If the password is wrong too many times, the login is blocked for 15 minutes. It clears by itself.

`must_change_password` exists after `docs/sql/2026-10-admin-reset-password.sql` has been run (staging) or the app has
started once (production).

## An account was switched off when the app started
On staging and production, every start of the app checks whether `admin`, `manager`, `staff`, `demo`, `ram_mgr`,
`sita_staff` or `hari_staff` still accepts a password that is published in this public repository: its own name, or its
name followed by `123` (the sample logins in the README). Any such account is **switched off**, and the log shows a line
starting `SECURITY:` with the account name (never the password).

- The Users page cannot switch an account back on, and an admin cannot reset the password of a switched-off account.
  If you really need the account again, run the SQL above in the Supabase SQL Editor with its username and a **new**
  temporary password (it also sets `is_active = true`). Leave unused demo accounts switched off.
- The old demo accounts (`demo`, `ram_mgr`, `sita_staff`, `hari_staff`) had a published password that is not their
  name. To have the check cover them too, put that value in the `SAMJHANA_SECURITY_PUBLISHEDPASSWORDS` environment
  variable on Render (separate several values with commas). It is public already, so a normal environment variable is
  fine. It is in the old `DemoDataSeederService`:
  `git show 0fc68c7~1:src/main/java/com/samjhana/service/DemoDataSeederService.java`.
