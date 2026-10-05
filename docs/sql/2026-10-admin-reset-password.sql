-- Admin password reset: run on Supabase STAGING (ddl-auto: validate) BEFORE deploying the branch that adds it.
-- Production (ddl-auto: update) adds the column itself; running this first is harmless there too.
-- Existing users get false, so nobody is forced to change a password.

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
