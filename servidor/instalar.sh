#!/usr/bin/env bash
# Instala y configura todo el VPS de Anmar. Se puede correr varias veces sin romper nada.
# Uso (como root, en el VPS):
#   git clone https://github.com/leodanmendez113/anmar-admin.git /srv/anmar/repos/anmar-admin
#   bash /srv/anmar/repos/anmar-admin/servidor/instalar.sh
set -euo pipefail

# IP desde la que Leo entra por SSH: fail2ban nunca la bloquea.
IP_LEO=${IP_LEO:-108.70.117.172}
RAIZ=/srv/anmar
AQUI=$(cd "$(dirname "$0")" && pwd)
export DEBIAN_FRONTEND=noninteractive

paso() { echo; echo "==> $*"; }

paso "Actualizando Ubuntu"
apt-get update -qq
apt-get -y -qq -o Dpkg::Options::=--force-confold upgrade
apt-get -y -qq install ufw fail2ban unattended-upgrades rsync git curl gnupg ca-certificates \
  debian-keyring debian-archive-keyring apt-transport-https

paso "Actualizaciones de seguridad automáticas"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

paso "Memoria de respaldo (swap 2 GB)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap -q /swapfile && swapon /swapfile
fi
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

paso "fail2ban (bloquea intentos de adivinar contraseñas por SSH)"
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
ignoreip = 127.0.0.1/8 ::1 $IP_LEO
EOF
systemctl enable -q --now fail2ban
systemctl restart fail2ban

paso "Firewall: solo SSH, web y HTTPS"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

paso "Node 22 LTS y Caddy (repositorios oficiales firmados)"
install -d -m 0755 /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/nodesource.gpg ]; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
fi
if [ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
fi
apt-get update -qq
apt-get -y -qq install nodejs caddy

paso "Usuarios y carpetas"
id anmar  >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin anmar
id deploy >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/deploy --shell /usr/sbin/nologin deploy
install -d -m 0755 -o root   -g root   $RAIZ $RAIZ/api $RAIZ/estado
install -d -m 0755 -o deploy -g deploy $RAIZ/repos $RAIZ/sitios
install -d -m 0755 -o deploy -g deploy $RAIZ/sitios/portafolio $RAIZ/sitios/eventos $RAIZ/sitios/comercial $RAIZ/sitios/admin
install -d -m 0755 -o anmar  -g anmar  $RAIZ/datos
install -d -m 0700 -o anmar  -g anmar  $RAIZ/config
chown -R deploy:deploy $RAIZ/repos

paso "Datos iniciales (solo si todavía no existen)"
for f in videos precios-eventos precios-comercial; do
  if [ ! -f $RAIZ/datos/$f.json ]; then
    install -m 0644 -o anmar -g anmar "$AQUI/datos-iniciales/$f.json" $RAIZ/datos/$f.json
  fi
done

paso "Comandos, servicios y Caddy"
install -m 0755 "$AQUI/actualizar.sh" /usr/local/sbin/anmar-actualizar
install -m 0755 "$AQUI/anmar-clave.sh" /usr/local/bin/anmar-clave
install -m 0644 "$AQUI/systemd/anmar-api.service"        /etc/systemd/system/
install -m 0644 "$AQUI/systemd/anmar-actualizar.service" /etc/systemd/system/
install -m 0644 "$AQUI/systemd/anmar-actualizar.timer"   /etc/systemd/system/
install -m 0644 "$AQUI/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl daemon-reload

paso "Primera publicación de las 4 webs (tarda unos minutos)"
/usr/local/sbin/anmar-actualizar --todo
systemctl enable -q --now anmar-api anmar-actualizar.timer
systemctl reload caddy || systemctl restart caddy

paso "Listo"
echo "Webs:  https://portafolio. / eventos. / comercial. / admin.anmarproductions.com"
[ -f $RAIZ/config/credenciales.json ] || echo "FALTA: corre 'anmar-clave' (solo, en su propia línea) para crear el usuario y la contraseña del admin."
