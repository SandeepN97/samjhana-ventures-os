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
2. Run this with a new temporary password of **12 or more characters**:

   ```sql
   UPDATE users
   SET password_hash = extensions.crypt('Temp-Pass-12chars!', extensions.gen_salt('bf', 10)),
       must_change_password = true
   WHERE username = 'admin';
   ```
3. Log in with the temporary password and choose a new one when asked.
4. The SQL history keeps the temporary password, so change it straight away. Old sessions end automatically.

If the password is wrong too many times, the login is blocked for 15 minutes. It clears by itself.

`must_change_password` exists after `docs/sql/2026-10-admin-reset-password.sql` has been run (staging) or the app has
started once (production).
