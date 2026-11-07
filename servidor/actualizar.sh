#!/usr/bin/env bash
# Publicación automática "al revés": el VPS revisa GitHub y, si un repositorio tiene commits
# nuevos en main, lo compila y publica. Lo corre el timer anmar-actualizar cada 2 minutos.
# Se instala como /usr/local/sbin/anmar-actualizar. Ver el registro: journalctl -u anmar-actualizar
#
# Uso manual:  anmar-actualizar           (solo lo que cambió)
#              anmar-actualizar --todo    (vuelve a publicar todo)
set -euo pipefail

GITHUB=https://github.com/leodanmendez113
RAIZ=/srv/anmar
# repositorio -> sitio
declare -A SITIOS=(
  [angel-portafolio]=portafolio
  [angel-cotizador]=eventos
  [anmar-comercial]=comercial
  [anmar-admin]=admin
)

# Evita que dos ejecuciones se pisen.
exec 9>/run/anmar-actualizar.lock
flock -n 9 || exit 0

como_deploy() { runuser -u deploy -- "$@"; }
TODO=${1:-}

for repo in "${!SITIOS[@]}"; do
  sitio=${SITIOS[$repo]}
  dir=$RAIZ/repos/$repo
  marca=$RAIZ/estado/$repo.publicado

  if [ ! -d "$dir/.git" ]; then
    como_deploy git clone -q "$GITHUB/$repo.git" "$dir"
  fi
  if ! como_deploy git -C "$dir" fetch -q origin main; then
    echo "[$repo] no se pudo consultar GitHub; se reintenta en 2 minutos"
    continue
  fi
  remoto=$(como_deploy git -C "$dir" rev-parse origin/main)
  if [ "$TODO" != "--todo" ] && [ -f "$marca" ] && [ "$(cat "$marca")" = "$remoto" ]; then
    continue
  fi

  echo "[$repo] publicando ${remoto:0:7}…"
  como_deploy git -C "$dir" reset -q --hard origin/main
  web=$dir
  [ "$repo" = "anmar-admin" ] && web=$dir/web

  # Si la compilación falla, la web publicada queda como estaba y se reintenta en el próximo ciclo.
  if ! como_deploy bash -c "cd '$web' && npm ci --no-audit --no-fund --loglevel=error && npm run build --silent"; then
    echo "[$repo] ERROR al compilar; la web publicada no cambió"
    continue
  fi
  rsync -a --delete "$web/dist/" "$RAIZ/sitios/$sitio/"

  if [ "$repo" = "anmar-admin" ]; then
    rsync -a --delete --exclude '*.test.js' --exclude '.credenciales-dev.json' "$dir/api/" "$RAIZ/api/"
    systemctl restart anmar-api
  fi

  echo "$remoto" > "$marca"
  echo "[$repo] publicado en $sitio.anmarproductions.com"
done
