import './base.css'
import './admin.css'
import { api } from './api.js'
import { crearVideos } from './videos.js'
import { crearEventos } from './eventos.js'
import { crearComercial } from './comercial.js'
import { crearContacto } from './contacto.js'
import { crearBodas } from './bodas.js'
import { TURNSTILE_SITE_KEY } from './config.js'

const $ = (sel) => document.querySelector(sel)

// ---------- Cloudflare Turnstile ----------
// Cada token sirve para un solo intento: después de un login fallido se pide uno nuevo.
let turnstileId = null
let turnstileToken = ''

function montarTurnstile(intentos = 0) {
  if (turnstileId !== null) return
  if (!window.turnstile) {
    if (intentos > 50) {
      $('[data-error-login]').textContent = 'No cargó la verificación de seguridad. Revisa tu conexión o desactiva el bloqueador de anuncios.'
      return
    }
    setTimeout(() => montarTurnstile(intentos + 1), 200)
    return
  }
  turnstileId = window.turnstile.render('[data-turnstile]', {
    sitekey: TURNSTILE_SITE_KEY,
    theme: 'dark',
    language: 'es',
    size: 'flexible',
    callback: (token) => { turnstileToken = token },
    'expired-callback': () => { turnstileToken = '' },
    'error-callback': () => { turnstileToken = '' }
  })
}

function reiniciarTurnstile() {
  turnstileToken = ''
  if (turnstileId !== null) window.turnstile?.reset(turnstileId)
}

const SECCIONES = {
  videos: { titulo: 'Videos', archivo: 'videos', crear: crearVideos },
  eventos: { titulo: 'Precios eventos', archivo: 'precios-eventos', crear: crearEventos },
  comercial: { titulo: 'Precios comercial', archivo: 'precios-comercial', crear: crearComercial },
  bodas: { titulo: 'Bodas', archivo: 'bodas', crear: crearBodas },
  contacto: { titulo: 'Contacto', archivo: 'contacto', crear: crearContacto }
}

let actual = null // { clave, editor, original }

function mostrar(pantalla) {
  $('[data-cargando]').hidden = pantalla !== 'cargando'
  $('[data-acceso]').hidden = pantalla !== 'acceso'
  $('[data-app]').hidden = pantalla !== 'app'
  if (pantalla === 'acceso') montarTurnstile()
}

const hayCambios = () => actual && JSON.stringify(actual.editor.datos()) !== actual.original

function marcarCambios() {
  const hay = hayCambios()
  $('[data-guardar]').disabled = !hay
  $('[data-estado]').textContent = hay ? 'Tienes cambios sin guardar' : 'Sin cambios'
  $('[data-barra]').classList.toggle('pendiente', hay)
}

async function abrir(clave) {
  if (actual?.clave === clave) return
  if (hayCambios() && !confirm('Tienes cambios sin guardar. ¿Salir de esta sección sin guardar?')) return
  const s = SECCIONES[clave]
  document.querySelectorAll('[data-pestana]').forEach((b) => b.setAttribute('aria-selected', b.dataset.pestana === clave))
  $('[data-titulo]').textContent = s.titulo
  const contenedor = $('[data-contenido]')
  contenedor.innerHTML = '<p class="ayuda">Cargando…</p>'
  try {
    const datos = await api.leer(s.archivo)
    // Un contenedor nuevo por sección, para que no se acumulen eventos de la anterior.
    const nuevo = contenedor.cloneNode(false)
    contenedor.replaceWith(nuevo)
    actual = { clave, original: '', editor: s.crear(nuevo, datos, marcarCambios) }
    actual.original = JSON.stringify(actual.editor.datos())
    marcarCambios()
    history.replaceState(null, '', `#${clave}`)
  } catch (e) {
    manejarError(e, contenedor)
  }
}

function manejarError(e, donde) {
  if (e.estado === 401) { mostrar('acceso'); $('[data-error-login]').textContent = e.message; return }
  if (donde) donde.innerHTML = `<p class="error">${e.message}</p>`
  else $('[data-estado]').textContent = e.message
}

$('[data-guardar]').addEventListener('click', async () => {
  const boton = $('[data-guardar]')
  boton.disabled = true
  $('[data-estado]').textContent = 'Guardando…'
  try {
    const datos = actual.editor.datos()
    await api.guardar(SECCIONES[actual.clave].archivo, datos)
    actual.original = JSON.stringify(datos)
    await actual.editor.despuesDeGuardar?.()
    marcarCambios()
    $('[data-estado]').textContent = '✓ Guardado. Ya se ve en la web.'
  } catch (e) {
    boton.disabled = false
    manejarError(e)
  }
})

document.querySelectorAll('[data-pestana]').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.pestana)))

$('[data-form-login]').addEventListener('submit', async (e) => {
  e.preventDefault()
  const error = $('[data-error-login]')
  if (!turnstileToken) {
    error.textContent = 'Espera a que termine la verificación de seguridad (el recuadro de arriba).'
    return
  }
  error.textContent = ''
  try {
    await api.entrar($('#usuario').value.trim(), $('#clave').value, turnstileToken)
    $('#clave').value = ''
    entrarApp()
  } catch (err) {
    error.textContent = err.message
    reiniciarTurnstile()
  }
})

$('[data-salir]').addEventListener('click', async () => {
  if (hayCambios() && !confirm('Tienes cambios sin guardar. ¿Salir igual?')) return
  await api.salir().catch(() => {})
  location.reload()
})

addEventListener('beforeunload', (e) => { if (hayCambios()) e.preventDefault() })

function entrarApp() {
  mostrar('app')
  actual = null
  const inicial = location.hash.slice(1)
  abrir(SECCIONES[inicial] ? inicial : 'videos')
}

api.sesion().then(entrarApp).catch(() => mostrar('acceso'))
