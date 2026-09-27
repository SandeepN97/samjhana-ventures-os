#!/bin/sh
# Starts the app as the unprivileged "app" user.
#
# The container begins as root for one reason: Render mounts Secret Files (the Supabase CA
# certificate) under /etc/secrets, and they may be readable by root only. Copy them somewhere the
# app user owns, then drop root for good before Java starts.
set -eu

if [ -d /etc/secrets ]; then
  mkdir -p /app/secrets
  cp -R /etc/secrets/. /app/secrets/ 2>/dev/null || true
  chown -R app:app /app/secrets
  chmod -R go-rwx /app/secrets
fi

# The datasource reads SUPABASE_SSL_ROOT_CERT; point it at the readable copy unless it was set on purpose.
if [ -z "${SUPABASE_SSL_ROOT_CERT:-}" ] && [ -f /app/secrets/supabase-ca.crt ]; then
  export SUPABASE_SSL_ROOT_CERT=/app/secrets/supabase-ca.crt
fi

exec setpriv --reuid=app --regid=app --init-groups --inh-caps=-all -- java -jar /app/app.jar "$@"
