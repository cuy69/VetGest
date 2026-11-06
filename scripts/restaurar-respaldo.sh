#!/usr/bin/env bash
# Restaura un respaldo cifrado de .github/workflows/respaldo-bd.yml en una base PostgreSQL VACÍA.
# Uso: scripts/restaurar-respaldo.sh vetgest-AAAAMMDD-HHMM.dump.gpg
# Pide (sin mostrarlas) la frase de cifrado y la URL de la base destino. Requiere gpg y Docker.
# Nunca restaures sobre la base de producción en uso: crea primero una base o un proyecto nuevo.
set -euo pipefail
file="${1:?Indica el archivo .dump.gpg}"
[ -f "$file.sha256" ] && (cd "$(dirname "$file")" && shasum -a 256 -c "$(basename "$file").sha256")
read -rsp "Frase de cifrado: " BACKUP_PASSPHRASE; echo
read -rsp "URL de la base destino (vacía): " TARGET_URL; echo
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
  --decrypt --output "$work/respaldo.dump" "$file"
# El esquema public ya existe en el destino, así que se omite su CREATE SCHEMA.
# Las políticas RLS nombran al rol vetgest_app: debe existir antes (sin contraseña; se la pones después).
# Para una base en esta Mac usa host.docker.internal en lugar de localhost.
docker run --rm -e TARGET_URL="${TARGET_URL/+psycopg/}" -v "$work:/in:ro" postgres:17-alpine sh -c '
  psql "$TARGET_URL" -qc "DO \$\$ BEGIN CREATE ROLE vetgest_app NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$" &&
  pg_restore --list /in/respaldo.dump | grep -vE " SCHEMA - public | COMMENT - SCHEMA public " > /tmp/lista &&
  pg_restore --dbname="$TARGET_URL" --use-list=/tmp/lista --no-owner --no-privileges --exit-on-error /in/respaldo.dump'
echo "Restauración terminada. Comprueba los conteos de tablas antes de usar la base."
