#!/usr/bin/env bash
# Crea o cambia el usuario y la contraseña del admin (https://admin.anmarproductions.com).
# Se instala como /usr/local/bin/anmar-clave. Correr como root en el VPS: anmar-clave
#
# La terminal (bash) pide los datos y oculta la contraseña mientras se escribe.
# Se pasan a la API por la entrada estándar, nunca como argumento (no quedan a la vista en `ps`).
set -euo pipefail

if [ ! -t 0 ]; then
  echo "anmar-clave tiene que correrse solo, en una terminal (no pegado junto con otros comandos)." >&2
  exit 1
fi

read -rp "Usuario del admin (ej: angel): " usuario
read -rsp "Contraseña nueva (mínimo 8 caracteres): " clave; echo
read -rsp "Repite la contraseña: " repetida; echo

if [ "$clave" != "$repetida" ]; then
  echo "Las contraseñas no coinciden. No se guardó nada." >&2
  exit 1
fi

printf '%s\n%s\n' "$usuario" "$clave" |
  runuser -u anmar -- env CREDENCIALES=/srv/anmar/config/credenciales.json node /srv/anmar/api/clave.js
