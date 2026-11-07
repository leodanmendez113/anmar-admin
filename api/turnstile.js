import { CONFIG } from './config.js'

// Verifica con Cloudflare que el login lo hizo una persona (Turnstile).
// Devuelve { ok: true } o { ok: false, estado, error, contarFallo }.
export async function verificarTurnstile(token, ip) {
  if (!CONFIG.turnstileSecreto) {
    // En producción nunca se deja pasar sin verificación.
    return CONFIG.cookieSegura
      ? { ok: false, estado: 503, error: 'La verificación de seguridad no está configurada en el servidor.' }
      : { ok: true }
  }
  if (!token || token.length > 2048) {
    return { ok: false, estado: 400, error: 'Completa la verificación de seguridad antes de entrar.' }
  }

  let respuesta
  try {
    const r = await fetch(CONFIG.turnstileUrl, {
      method: 'POST',
      body: new URLSearchParams({ secret: CONFIG.turnstileSecreto, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000)
    })
    respuesta = await r.json()
  } catch {
    return { ok: false, estado: 502, error: 'No se pudo contactar la verificación de seguridad. Intenta de nuevo.' }
  }

  const hostOk = !CONFIG.turnstileHost || respuesta.hostname === CONFIG.turnstileHost
  if (!respuesta.success || !hostOk) {
    return { ok: false, estado: 403, error: 'No se pudo verificar que eres una persona. Intenta de nuevo.', contarFallo: true }
  }
  return { ok: true }
}
