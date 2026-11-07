// Pruebas de la API con datos temporales. Correr con: npm test (dentro de admin/api).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, cpSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'

// Servidor falso que imita la verificación de Cloudflare Turnstile.
const cloudflare = createServer((req, res) => {
  let cuerpo = ''
  req.on('data', (p) => (cuerpo += p))
  req.on('end', () => {
    const f = new URLSearchParams(cuerpo)
    const ok = f.get('secret') === 'secreto-prueba' && f.get('response') === 'token-bueno'
    const hostname = f.get('response') === 'token-otro-sitio' ? 'malo.com' : 'prueba.local'
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: ok || f.get('response') === 'token-otro-sitio', hostname }))
  })
})
await new Promise((r) => cloudflare.listen(0, '127.0.0.1', r))

const tmp = mkdtempSync(join(tmpdir(), 'anmar-api-'))
cpSync(new URL('../servidor/datos-iniciales/', import.meta.url).pathname, tmp, { recursive: true })
process.env.DATOS_DIR = tmp
process.env.CREDENCIALES = join(tmp, 'cred.json')
process.env.ORIGEN = 'http://prueba.local'
process.env.TURNSTILE_SECRET = 'secreto-prueba'
process.env.TURNSTILE_URL = `http://127.0.0.1:${cloudflare.address().port}/siteverify`
process.env.TURNSTILE_HOST = 'prueba.local'

const { cifrarClave } = await import('./sesiones.js')
const { crearServidor } = await import('./servidor.js')
writeFileSync(process.env.CREDENCIALES, JSON.stringify({ usuario: 'angel', hash: cifrarClave('clave-de-prueba-123') }))

let base, servidor, cookie = ''
before(() => new Promise((r) => { servidor = crearServidor().listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${servidor.address().port}`; r() }) }))
after(() => { servidor.close(); cloudflare.close() })

const pedir = (ruta, { metodo = 'GET', cuerpo, origen = 'http://prueba.local', ip = '1.1.1.1', conCookie = true } = {}) =>
  fetch(base + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(origen ? { Origin: origen } : {}),
      'X-Forwarded-For': ip,
      ...(conCookie && cookie ? { Cookie: cookie } : {})
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
  })

test('sin sesión no se pueden leer ni guardar datos', async () => {
  assert.equal((await pedir('/api/datos/videos', { conCookie: false })).status, 401)
  assert.equal((await pedir('/api/datos/videos', { metodo: 'PUT', cuerpo: {}, conCookie: false })).status, 401)
})

test('login incorrecto da 401 y se bloquea tras 5 intentos', async () => {
  for (let i = 0; i < 5; i++) {
    const r = await pedir('/api/login', { metodo: 'POST', cuerpo: { usuario: 'angel', clave: 'mal', turnstile: 'token-bueno' }, ip: '9.9.9.9' })
    assert.equal(r.status, 401)
  }
  const r = await pedir('/api/login', { metodo: 'POST', cuerpo: { usuario: 'angel', clave: 'clave-de-prueba-123', turnstile: 'token-bueno' }, ip: '9.9.9.9' })
  assert.equal(r.status, 429)
})

test('login desde otro origen es rechazado', async () => {
  const r = await pedir('/api/login', { metodo: 'POST', cuerpo: { usuario: 'angel', clave: 'clave-de-prueba-123', turnstile: 'token-bueno' }, origen: 'https://malo.com' })
  assert.equal(r.status, 403)
})

test('Turnstile: sin token, token falso o de otro sitio no entra aunque la clave sea correcta', async () => {
  const login = (turnstile) => pedir('/api/login', { metodo: 'POST', cuerpo: { usuario: 'angel', clave: 'clave-de-prueba-123', turnstile }, ip: '5.5.5.5' })
  assert.equal((await login(undefined)).status, 400)
  assert.equal((await login('token-falso')).status, 403)
  const r = await login('token-otro-sitio')
  assert.equal(r.status, 403)
  assert.equal(r.headers.get('set-cookie'), null)
})

test('login correcto entrega cookie segura y abre sesión', async () => {
  const r = await pedir('/api/login', { metodo: 'POST', cuerpo: { usuario: 'angel', clave: 'clave-de-prueba-123', turnstile: 'token-bueno' } })
  assert.equal(r.status, 200)
  const c = r.headers.get('set-cookie')
  assert.match(c, /HttpOnly/)
  assert.match(c, /SameSite=Strict/)
  cookie = c.split(';')[0]
  assert.equal((await pedir('/api/sesion')).status, 200)
})

test('guarda videos válidos, guarda historial y rechaza inválidos', async () => {
  const actual = await (await pedir('/api/datos/videos')).json()
  actual.videos[0].titulo = '  Título nuevo  '
  assert.equal((await pedir('/api/datos/videos', { metodo: 'PUT', cuerpo: actual })).status, 200)
  const guardado = JSON.parse(readFileSync(join(tmp, 'videos.json'), 'utf8'))
  assert.equal(guardado.videos[0].titulo, 'Título nuevo')
  assert.ok(readdirSync(join(tmp, 'historial')).some((f) => f.startsWith('videos.')))

  const malo = structuredClone(actual)
  malo.videos[0].id = 'no-es-id'
  const r = await pedir('/api/datos/videos', { metodo: 'PUT', cuerpo: malo })
  assert.equal(r.status, 400)
  assert.match((await r.json()).error, /ID de YouTube/)
})

test('valida precios de eventos y de comercial', async () => {
  const p = await (await pedir('/api/datos/precios-eventos')).json()
  p.tabla[7][1] = 1000
  assert.equal((await pedir('/api/datos/precios-eventos', { metodo: 'PUT', cuerpo: p })).status, 200)
  p.tabla[0][1] = -5
  assert.equal((await pedir('/api/datos/precios-eventos', { metodo: 'PUT', cuerpo: p })).status, 400)

  const c = { activo: true, paquetes: [{ nombre: 'Reel básico', descripcion: '1 reel', precio: 300, destacado: false, incluye: ['1 hora de grabación', ''] }] }
  assert.equal((await pedir('/api/datos/precios-comercial', { metodo: 'PUT', cuerpo: c })).status, 200)
  assert.deepEqual(JSON.parse(readFileSync(join(tmp, 'precios-comercial.json'), 'utf8')).paquetes[0].incluye, ['1 hora de grabación'])
})

test('cerrar sesión invalida la cookie', async () => {
  assert.equal((await pedir('/api/logout', { metodo: 'POST' })).status, 200)
  assert.equal((await pedir('/api/sesion')).status, 401)
})
