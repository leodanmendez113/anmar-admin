// Cloudflare Turnstile (anti-bots en el login). La Site Key es pública.
// En la compu de desarrollo se usa la clave de prueba oficial de Cloudflare, que siempre aprueba.
export const TURNSTILE_SITE_KEY = import.meta.env.DEV
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAF3u7QVOZVaE_OVG'
