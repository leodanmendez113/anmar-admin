import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CONFIG } from './config.js'

// ---------- Contraseñas ----------
// Se guarda solo el "hash" (la contraseña cifrada de forma que no se puede revertir).
export function cifrarClave(clave) {
  const sal = randomBytes(16)
  const hash = scryptSync(clave, sal, 64)
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`
}

export function claveCorrecta(clave, guardada) {
  const [tipo, salHex, hashHex] = String(guardada).split('$')
  if (tipo !== 'scrypt' || !salHex || !hashHex) return false
  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = scryptSync(String(clave), Buffer.from(salHex, 'hex'), esperado.length)
  return timingSafeEqual(esperado, calculado)
}

function leerCredenciales() {
  try {
    return JSON.parse(readFileSync(CONFIG.credenciales, 'utf8'))
  } catch {
    return null // todavía no se corrió `anmar-clave`
  }
}

// ---------- Límite de intentos ----------
// 5 intentos fallidos por IP cada 15 minutos.
const INTENTOS_MAX = 5
const VENTANA_MS = 15 * 60 * 1000
const fallos = new Map()

export function bloqueada(ip) {
  const f = fallos.get(ip)
  if (!f) return false
  if (Date.now() - f.desde > VENTANA_MS) { fallos.delete(ip); return false }
  return f.cantidad >= INTENTOS_MAX
}

export function anotarFallo(ip) {
  const f = fallos.get(ip)
  if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(ip, { cantidad: 1, desde: Date.now() })
  else f.cantidad++
}

// ---------- Sesiones ----------
// Se guardan en memoria: si el servicio se reinicia, Ángel solo tiene que volver a entrar.
const sesiones = new Map()

export function iniciarSesion(ip, usuario, clave) {
  const cred = leerCredenciales()
  const ok = cred && usuario === cred.usuario && claveCorrecta(clave, cred.hash)
  if (!ok) { anotarFallo(ip); return null }
  fallos.delete(ip)
  const token = randomBytes(32).toString('hex')
  sesiones.set(token, { usuario, vence: Date.now() + CONFIG.horasSesion * 3600 * 1000 })
  return token
}

export function sesionValida(token) {
  const s = token && sesiones.get(token)
  if (!s) return null
  if (Date.now() > s.vence) { sesiones.delete(token); return null }
  return s
}

export const cerrarSesion = (token) => sesiones.delete(token)

export function cookieSesion(token, maxAge = CONFIG.horasSesion * 3600) {
  return [
    `anmar_sesion=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/api', `Max-Age=${maxAge}`,
    CONFIG.cookieSegura ? 'Secure' : ''
  ].filter(Boolean).join('; ')
}

export function tokenDeCookie(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)anmar_sesion=([a-f0-9]{64})/)
  return m ? m[1] : null
}
