// Configuración por variables de entorno (en el VPS las define el servicio systemd).
export const CONFIG = {
  puerto: Number(process.env.PUERTO || 3100),
  // Carpeta donde viven videos.json, precios-eventos.json y precios-comercial.json.
  datos: process.env.DATOS_DIR || new URL('../servidor/datos-iniciales/', import.meta.url).pathname,
  // Archivo con el usuario y la contraseña cifrada del admin (lo crea `anmar-clave`).
  credenciales: process.env.CREDENCIALES || new URL('./.credenciales-dev.json', import.meta.url).pathname,
  // Único origen desde el que se aceptan cambios (protege contra formularios de otras webs).
  origen: process.env.ORIGEN || 'http://localhost:5175',
  // En producción la cookie solo viaja por HTTPS.
  cookieSegura: process.env.NODE_ENV === 'production',
  versionesGuardadas: 30,
  horasSesion: 12,
  // Cloudflare Turnstile (anti-bots en el login). La clave secreta vive solo en el VPS
  // (/etc/anmar/api.env). Sin clave: en desarrollo se omite; en producción se rechaza el login.
  turnstileSecreto: process.env.TURNSTILE_SECRET || '',
  turnstileUrl: process.env.TURNSTILE_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  // Si se define, el token tiene que haberse generado en ese dominio.
  turnstileHost: process.env.TURNSTILE_HOST || ''
}
