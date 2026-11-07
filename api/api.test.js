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
process.env.MEDIA_DIR = join(tmp, 'media')
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

test('contacto: guarda datos válidos (limpia @ y espacios) y rechaza inválidos', async () => {
  const base = await (await pedir('/api/datos/contacto')).json()
  const bueno = { ...base, whatsapp: '+1 (305) 555-1234', email: 'angel@ejemplo.com', instagram: '@anmar.prod', youtube: 'https://www.youtube.com/@anmar' }
  assert.equal((await pedir('/api/datos/contacto', { metodo: 'PUT', cuerpo: bueno })).status, 200)
  const g = JSON.parse(readFileSync(join(tmp, 'contacto.json'), 'utf8'))
  assert.equal(g.whatsapp, '13055551234')
  assert.equal(g.instagram, 'anmar.prod')

  for (const [campo, valor, texto] of [
    ['whatsapp', '305-ABC', /WhatsApp/],
    ['email', 'no-es-email', /email/],
    ['youtube', 'https://malo.com/canal', /YouTube/],
    ['instagram', 'con espacio', /Instagram/]
  ]) {
    const r = await pedir('/api/datos/contacto', { metodo: 'PUT', cuerpo: { ...bueno, [campo]: valor } })
    assert.equal(r.status, 400, campo)
    assert.match((await r.json()).error, texto)
  }
  const sinMensaje = await pedir('/api/datos/contacto', { metodo: 'PUT', cuerpo: { ...bueno, mensajes: { ...bueno.mensajes, eventos: ' ' } } })
  assert.equal(sinMensaje.status, 400)
})

test('fotos de bodas: sube JPEG/WebP, rechaza lo que no es imagen y borra', async () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)])
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(100, 2)])
  const subir = (buf, opciones = {}) => pedir('/api/media/bodas', { metodo: 'POST', cuerpo: { datos: buf.toString('base64'), chica: buf.toString('base64') }, ...opciones })

  assert.equal((await subir(jpeg, { conCookie: false })).status, 401)
  assert.equal((await subir(Buffer.from('<?php echo 1; ?>'))).status, 415)
  const r1 = await subir(jpeg)
  assert.equal(r1.status, 200)
  const { archivo } = await r1.json()
  assert.match(archivo, /^[a-f0-9]{24}\.jpg$/)
  assert.ok(readdirSync(join(tmp, 'media', 'bodas')).includes(archivo))
  assert.ok(readdirSync(join(tmp, 'media', 'bodas')).includes(archivo.replace('.jpg', '-m.jpg')))
  assert.match((await (await subir(webp)).json()).archivo, /\.webp$/)
  const mezcla = await pedir('/api/media/bodas', { metodo: 'POST', cuerpo: { datos: jpeg.toString('base64'), chica: Buffer.from('nada').toString('base64') } })
  assert.equal(mezcla.status, 415)

  assert.equal((await pedir('/api/media/bodas/../../cred.json', { metodo: 'DELETE' })).status, 404)
  assert.equal((await pedir('/api/media/bodas/no-valido.jpg', { metodo: 'DELETE' })).status, 400)
  assert.equal((await pedir(`/api/media/bodas/${archivo}`, { metodo: 'DELETE' })).status, 200)
  assert.ok(!readdirSync(join(tmp, 'media', 'bodas')).includes(archivo))
  assert.ok(!readdirSync(join(tmp, 'media', 'bodas')).includes(archivo.replace('.jpg', '-m.jpg')))
})

test('bodas: valida películas, fotos y portada', async () => {
  const base = await (await pedir('/api/datos/bodas')).json()
  const foto = { archivo: 'a'.repeat(24) + '.webp', ancho: 2000, alto: 1333, oculto: false }
  const bueno = { ...base, portada: foto.archivo, fotos: [foto] }
  assert.equal((await pedir('/api/datos/bodas', { metodo: 'PUT', cuerpo: bueno })).status, 200)

  const dosDestacadas = { ...bueno, peliculas: [...bueno.peliculas, { ...bueno.peliculas[0], plataforma: 'youtube', id: 'dQw4w9WgXcQ' }] }
  assert.equal((await pedir('/api/datos/bodas', { metodo: 'PUT', cuerpo: dosDestacadas })).status, 400)
  assert.equal((await pedir('/api/datos/bodas', { metodo: 'PUT', cuerpo: { ...bueno, portada: 'b'.repeat(24) + '.webp' } })).status, 400)
  const malId = { ...bueno, peliculas: [{ ...bueno.peliculas[0], id: 'abc' }] }
  assert.equal((await pedir('/api/datos/bodas', { metodo: 'PUT', cuerpo: malId })).status, 400)
  const malaMini = { ...bueno, peliculas: [{ ...bueno.peliculas[0], miniatura: 'https://malo.com/x.jpg' }] }
  assert.equal((await pedir('/api/datos/bodas', { metodo: 'PUT', cuerpo: malaMini })).status, 400)
})

test('cerrar sesión invalida la cookie', async () => {
  assert.equal((await pedir('/api/logout', { metodo: 'POST' })).status, 200)
  assert.equal((await pedir('/api/sesion')).status, 401)
})
