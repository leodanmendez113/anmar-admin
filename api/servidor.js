import { createServer } from 'node:http'
import { CONFIG } from './config.js'
import { VALIDADORES } from './validar.js'
import { leer, guardar, guardarFoto, borrarFoto } from './archivos.js'
import {
  bloqueada, anotarFallo, iniciarSesion, sesionValida, cerrarSesion, cookieSesion, tokenDeCookie
} from './sesiones.js'
import { verificarTurnstile } from './turnstile.js'

// API del admin. Solo escucha en 127.0.0.1: desde afuera se llega únicamente a través de Caddy
// (https://admin.anmarproductions.com/api/...).
//
//   POST /api/login            { usuario, clave, turnstile }
//   POST /api/logout
//   GET  /api/sesion
//   GET  /api/datos/:nombre    nombre = videos | precios-eventos | precios-comercial | contacto
//   PUT  /api/datos/:nombre
//   POST   /api/media/bodas            { datos, chica: <fotos en base64, JPEG o WebP> } → { archivo }
//   DELETE /api/media/bodas/:archivo

const LIMITE_CUERPO = 200 * 1024
const LIMITE_FOTO = 3 * 1024 * 1024
const LIMITE_CHICA = 600 * 1024
// En base64 las fotos ocupan ~4/3 de su tamaño.
const LIMITE_CUERPO_FOTO = Math.ceil((LIMITE_FOTO + LIMITE_CHICA) * 4 / 3) + 1024

function responder(res, estado, cuerpo, extra = {}) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra })
  res.end(JSON.stringify(cuerpo))
}

function leerCuerpo(req, limite = LIMITE_CUERPO) {
  return new Promise((resolver, rechazar) => {
    let total = 0
    const partes = []
    req.on('data', (p) => {
      total += p.length
      if (total > limite) { rechazar(new Error('grande')); req.destroy() } else partes.push(p)
    })
    req.on('end', () => {
      try { resolver(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')) } catch { rechazar(new Error('json')) }
    })
    req.on('error', rechazar)
  })
}

// Caddy pasa la IP real del visitante en X-Forwarded-For.
const ipDe = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress

// Los cambios solo se aceptan si vienen de la propia web del admin.
const origenValido = (req) => req.headers.origin === CONFIG.origen

export function crearServidor() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const metodo = req.method
    try {
      if (metodo !== 'GET' && !origenValido(req)) return responder(res, 403, { error: 'Origen no permitido.' })
      const sinCuerpo = url.pathname === '/api/logout' || metodo === 'DELETE'
      if (metodo !== 'GET' && !sinCuerpo && !String(req.headers['content-type']).startsWith('application/json')) {
        return responder(res, 415, { error: 'Se esperaba JSON.' })
      }

      if (url.pathname === '/api/login' && metodo === 'POST') {
        const ip = ipDe(req)
        if (bloqueada(ip)) return responder(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' })
        const { usuario, clave, turnstile } = await leerCuerpo(req)
        // Primero Cloudflare confirma que es una persona; recién después se revisa la contraseña.
        const humano = await verificarTurnstile(String(turnstile ?? ''), ip)
        if (!humano.ok) {
          if (humano.contarFallo) anotarFallo(ip)
          return responder(res, humano.estado, { error: humano.error })
        }
        const token = iniciarSesion(ip, String(usuario ?? ''), String(clave ?? ''))
        if (!token) return responder(res, 401, { error: 'Usuario o contraseña incorrectos.' })
        return responder(res, 200, { ok: true }, { 'Set-Cookie': cookieSesion(token) })
      }

      const token = tokenDeCookie(req)
      const sesion = sesionValida(token)

      if (url.pathname === '/api/logout' && metodo === 'POST') {
        cerrarSesion(token)
        return responder(res, 200, { ok: true }, { 'Set-Cookie': cookieSesion('', 0) })
      }
      if (url.pathname === '/api/sesion' && metodo === 'GET') {
        return sesion ? responder(res, 200, { usuario: sesion.usuario }) : responder(res, 401, { error: 'Sin sesión.' })
      }

      const m = url.pathname.match(/^\/api\/datos\/([a-z-]+)$/)
      if (m && VALIDADORES[m[1]]) {
        if (!sesion) return responder(res, 401, { error: 'Tu sesión venció. Vuelve a entrar.' })
        if (metodo === 'GET') return responder(res, 200, await leer(m[1]))
        if (metodo === 'PUT') {
          const r = VALIDADORES[m[1]](await leerCuerpo(req))
          if (!r.ok) return responder(res, 400, { error: r.error })
          await guardar(m[1], r.datos)
          return responder(res, 200, { ok: true })
        }
      }
      const media = url.pathname.match(/^\/api\/media\/bodas(?:\/([^/]+))?$/)
      if (media) {
        if (!sesion) return responder(res, 401, { error: 'Tu sesión venció. Vuelve a entrar.' })
        if (metodo === 'POST' && !media[1]) {
          const { datos, chica } = await leerCuerpo(req, LIMITE_CUERPO_FOTO)
          const grande = Buffer.from(String(datos ?? ''), 'base64')
          const peque = Buffer.from(String(chica ?? ''), 'base64')
          if (!grande.length || grande.length > LIMITE_FOTO || !peque.length || peque.length > LIMITE_CHICA) {
            return responder(res, 413, { error: 'La foto es demasiado grande (máx. 3 MB).' })
          }
          const archivo = await guardarFoto('bodas', grande, peque)
          if (!archivo) return responder(res, 415, { error: 'Ese archivo no es una foto JPEG o WebP.' })
          return responder(res, 200, { archivo })
        }
        if (metodo === 'DELETE' && media[1]) {
          if (!(await borrarFoto('bodas', media[1]))) return responder(res, 400, { error: 'Nombre de foto inválido.' })
          return responder(res, 200, { ok: true })
        }
      }
      responder(res, 404, { error: 'No encontrado.' })
    } catch (e) {
      if (e.message === 'grande') return responder(res, 413, { error: 'Los datos son demasiado grandes.' })
      if (e.message === 'json') return responder(res, 400, { error: 'JSON inválido.' })
      console.error(e)
      responder(res, 500, { error: 'Error interno del servidor.' })
    }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  crearServidor().listen(CONFIG.puerto, '127.0.0.1', () => console.log(`anmar-api escuchando en 127.0.0.1:${CONFIG.puerto}`))
}
