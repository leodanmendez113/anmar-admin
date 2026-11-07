import { api, escapar } from './api.js'
import { idDeYoutube } from './videos.js'
import { prepararFoto } from './fotos.js'

// Editor del portafolio de bodas (bodas.anmarproductions.com): películas (Vimeo/YouTube) y fotos.
// Las fotos se suben al instante; las borradas se eliminan del servidor recién al "Guardar".

function videoDeLink(texto) {
  const t = (texto || '').trim()
  const vimeo = t.match(/vimeo\.com\/(?:video\/|channels\/\w+\/|.*\/)?(\d{6,12})/)
  if (vimeo) return { plataforma: 'vimeo', id: vimeo[1] }
  const yt = idDeYoutube(t)
  return yt ? { plataforma: 'youtube', id: yt } : null
}

// Vimeo da la miniatura y el título por su servicio público oEmbed.
async function datosVimeo(id) {
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`)
    const d = await r.json()
    return { miniatura: String(d.thumbnail_url || '').replace(/-d_\d+x\d+.*$/, '-d_1280x720'), titulo: d.title || '' }
  } catch {
    return { miniatura: '', titulo: '' }
  }
}

const miniaturaDe = (p) => p.miniatura || (p.plataforma === 'youtube' ? `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg` : '')
const urlFoto = (archivo) => `/media/bodas/${archivo.replace(/\.(webp|jpg)$/, '-m.$1')}`

export function crearBodas(contenedor, datos, alCambiar) {
  const estado = structuredClone(datos)
  const porBorrar = new Set()

  contenedor.innerHTML = `
    <form class="panel" data-form-pelicula>
      <label for="link-boda">Agregar película</label>
      <div class="fila-input">
        <input id="link-boda" type="text" inputmode="url" autocomplete="off" placeholder="Link de Vimeo o YouTube" required />
        <button class="boton" type="submit">Agregar</button>
      </div>
      <p class="error" data-error-pelicula role="alert"></p>
    </form>
    <h2 class="sub">Películas</h2>
    <ol class="lista peliculas" data-peliculas></ol>
    <p class="vacio" data-vacio-peliculas hidden>Todavía no hay películas.</p>

    <h2 class="sub">Fotos</h2>
    <section class="panel">
      <label class="boton secundario subir">
        + Subir fotos
        <input type="file" accept="image/*" multiple data-subir hidden />
      </label>
      <p class="ayuda" data-progreso>Se achican solas antes de subir. La ★ marca la foto de portada.</p>
    </section>
    <ul class="grilla-fotos" data-fotos></ul>`

  const $ = (sel) => contenedor.querySelector(sel)
  const cambio = () => { pintar(); alCambiar() }

  // ---------- Películas ----------
  $('[data-form-pelicula]').addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = $('#link-boda')
    const error = $('[data-error-pelicula]')
    const v = videoDeLink(input.value)
    if (!v) { error.textContent = 'Ese link no parece de Vimeo ni de YouTube.'; return }
    if (estado.peliculas.some((p) => p.plataforma === v.plataforma && p.id === v.id)) { error.textContent = 'Esa película ya está en la lista.'; return }
    error.textContent = ''
    const extra = v.plataforma === 'vimeo' ? await datosVimeo(v.id) : { miniatura: '', titulo: '' }
    estado.peliculas.unshift({
      ...v, pareja: extra.titulo.slice(0, 60), lugar: '', miniatura: extra.miniatura,
      destacada: !estado.peliculas.some((p) => p.destacada), oculto: false
    })
    input.value = ''
    cambio()
  })

  $('[data-peliculas]').addEventListener('input', (e) => {
    const campo = e.target.dataset.campo
    if (!campo) return
    const i = Number(e.target.closest('li').dataset.i)
    const p = estado.peliculas[i]
    if (campo === 'destacada') estado.peliculas.forEach((x, j) => (x.destacada = j === i))
    else if (campo === 'oculto') p.oculto = !e.target.checked
    else p[campo] = e.target.value
    campo === 'pareja' || campo === 'lugar' ? alCambiar() : cambio()
  })

  // ---------- Fotos ----------
  $('[data-subir]').addEventListener('change', async (e) => {
    const archivos = [...e.target.files]
    e.target.value = ''
    const progreso = $('[data-progreso]')
    let subidas = 0
    for (const [n, archivo] of archivos.entries()) {
      progreso.textContent = `Subiendo ${n + 1} de ${archivos.length}…`
      try {
        const foto = await prepararFoto(archivo)
        const { archivo: nombre } = await api.subirFoto(foto.base64, foto.chica)
        estado.fotos.unshift({ archivo: nombre, ancho: foto.ancho, alto: foto.alto, oculto: false })
        if (!estado.portada) estado.portada = nombre
        subidas++
        cambio()
      } catch (err) {
        progreso.textContent = err.message
        return
      }
    }
    progreso.textContent = `✓ ${subidas} foto(s) subida(s). Toca "Guardar" para publicarlas.`
  })

  $('[data-fotos]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]')
    if (!b) return
    const i = Number(b.closest('li').dataset.i)
    const f = estado.fotos[i]
    const accion = b.dataset.accion
    if (accion === 'portada') estado.portada = f.archivo
    if (accion === 'ocultar') f.oculto = !f.oculto
    if (accion === 'subir' && i > 0) estado.fotos.splice(i - 1, 0, estado.fotos.splice(i, 1)[0])
    if (accion === 'bajar' && i < estado.fotos.length - 1) estado.fotos.splice(i + 1, 0, estado.fotos.splice(i, 1)[0])
    if (accion === 'borrar' && confirm('¿Borrar esta foto?')) {
      estado.fotos.splice(i, 1)
      porBorrar.add(f.archivo)
      if (estado.portada === f.archivo) estado.portada = estado.fotos[0]?.archivo || ''
    }
    cambio()
  })

  // Acciones comunes de la lista de películas (subir, bajar, borrar).
  $('[data-peliculas]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]')
    if (!b) return
    const i = Number(b.closest('li').dataset.i)
    const lista = estado.peliculas
    if (b.dataset.accion === 'subir' && i > 0) lista.splice(i - 1, 0, lista.splice(i, 1)[0])
    if (b.dataset.accion === 'bajar' && i < lista.length - 1) lista.splice(i + 1, 0, lista.splice(i, 1)[0])
    if (b.dataset.accion === 'borrar' && confirm('¿Borrar esta película?')) lista.splice(i, 1)
    cambio()
  })

  function pintar() {
    $('[data-vacio-peliculas]').hidden = estado.peliculas.length > 0
    $('[data-peliculas]').innerHTML = estado.peliculas.map((p, i) => `
      <li data-i="${i}" class="${p.oculto ? 'oculto' : ''}">
        <span></span>
        <img src="${escapar(miniaturaDe(p))}" alt="" loading="lazy" class="horizontal" />
        <div class="campos">
          <input type="text" data-campo="pareja" value="${escapar(p.pareja)}" placeholder="Pareja (ej: Sofía & Daniel)" maxlength="60" aria-label="Pareja" />
          <input type="text" data-campo="lugar" value="${escapar(p.lugar)}" placeholder="Lugar (ej: Miami, FL)" maxlength="60" aria-label="Lugar" />
          <div class="fila-campos">
            <label class="switch"><input type="radio" name="destacada" data-campo="destacada" ${p.destacada ? 'checked' : ''} /> Destacada</label>
            <label class="switch"><input type="checkbox" data-campo="oculto" ${p.oculto ? '' : 'checked'} /> Visible</label>
          </div>
          <div class="fila-campos">
            <small class="plataforma">${p.plataforma === 'vimeo' ? 'Vimeo' : 'YouTube'}</small>
            <span class="flechas">
              <button type="button" data-accion="subir" aria-label="Subir">↑</button>
              <button type="button" data-accion="bajar" aria-label="Bajar">↓</button>
              <button type="button" data-accion="borrar" class="peligro">Borrar</button>
            </span>
          </div>
        </div>
      </li>`).join('')

    $('[data-fotos]').innerHTML = estado.fotos.map((f, i) => `
      <li data-i="${i}" class="${f.oculto ? 'oculto' : ''} ${estado.portada === f.archivo ? 'es-portada' : ''}">
        <img src="${urlFoto(f.archivo)}" alt="" loading="lazy" />
        <div class="foto-acciones">
          <button type="button" data-accion="portada" aria-label="Usar de portada" title="Portada">★</button>
          <button type="button" data-accion="ocultar" aria-label="${f.oculto ? 'Mostrar' : 'Ocultar'}">${f.oculto ? '◌' : '●'}</button>
          <button type="button" data-accion="subir" aria-label="Mover antes">←</button>
          <button type="button" data-accion="bajar" aria-label="Mover después">→</button>
          <button type="button" data-accion="borrar" class="peligro" aria-label="Borrar">✕</button>
        </div>
      </li>`).join('')
  }

  pintar()
  return {
    datos: () => estado,
    // Después de guardar, se borran del servidor las fotos que se quitaron de la lista.
    despuesDeGuardar: async () => {
      for (const archivo of porBorrar) await api.borrarFoto(archivo).catch(() => {})
      porBorrar.clear()
    }
  }
}
