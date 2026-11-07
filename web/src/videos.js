import { escapar } from './api.js'

// ---------- Links de YouTube ----------
export function idDeYoutube(texto) {
  const t = (texto || '').trim()
  if (/^[\w-]{11}$/.test(t)) return t
  const m = t.match(/(?:youtube\.com\/(?:shorts\/|watch\?(?:.*&)?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}
const formatoDeLink = (texto) => (/\/shorts\//.test(texto) ? 'vertical' : 'horizontal')
const miniatura = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

// Editor de la lista de videos del portafolio. Trabaja sobre una copia en memoria;
// se guarda con el botón "Guardar" de la barra de abajo.
export function crearVideos(contenedor, datos, alCambiar) {
  const estado = structuredClone(datos)
  contenedor.innerHTML = `
    <form class="panel" data-form-agregar>
      <label for="link">Agregar video</label>
      <div class="fila-input">
        <input id="link" type="text" inputmode="url" autocomplete="off" placeholder="Pega el link de YouTube" required />
        <button class="boton" type="submit">Agregar</button>
      </div>
      <p class="error" data-error-link role="alert"></p>
    </form>
    <section class="panel">
      <div class="cat-cab">
        <h2>Categorías</h2>
        <form class="fila-input mini" data-form-cat>
          <input type="text" placeholder="Nueva categoría" aria-label="Nueva categoría" maxlength="30" required />
          <button class="boton chico" type="submit" aria-label="Agregar categoría">+</button>
        </form>
      </div>
      <ul class="chips" data-categorias></ul>
    </section>
    <p class="ayuda">Arrastra con ⠿ o usa las flechas para ordenar. El primero aparece arriba en la web.</p>
    <ol class="lista" data-lista></ol>
    <p class="vacio" data-vacio hidden>Todavía no hay videos. Pega un link de YouTube arriba.</p>`

  const $ = (sel) => contenedor.querySelector(sel)
  const lista = $('[data-lista]')
  const chips = $('[data-categorias]')
  const cambio = () => { pintar(); alCambiar() }

  $('[data-form-agregar]').addEventListener('submit', (e) => {
    e.preventDefault()
    const input = $('#link')
    const error = $('[data-error-link]')
    const id = idDeYoutube(input.value)
    if (!id) { error.textContent = 'Ese link no parece de YouTube. Copia el link del Short o del video y pégalo aquí.'; return }
    if (estado.videos.some((v) => v.id === id)) { error.textContent = 'Ese video ya está en la lista.'; return }
    error.textContent = ''
    estado.videos.unshift({ id, titulo: '', categoria: estado.categorias[0] || '', formato: formatoDeLink(input.value), oculto: false })
    input.value = ''
    cambio()
    lista.querySelector('input[data-campo="titulo"]')?.focus()
  })

  $('[data-form-cat]').addEventListener('submit', (e) => {
    e.preventDefault()
    const input = e.target.querySelector('input')
    const nombre = input.value.trim()
    if (nombre && !estado.categorias.includes(nombre)) estado.categorias.push(nombre)
    input.value = ''
    cambio()
  })
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-borrar-cat]')
    if (!b) return
    const nombre = b.dataset.borrarCat
    const usados = estado.videos.filter((v) => v.categoria === nombre).length
    if (usados && !confirm(`"${nombre}" tiene ${usados} video(s). Se quedarán sin categoría. ¿Borrar?`)) return
    estado.categorias = estado.categorias.filter((c) => c !== nombre)
    estado.videos.forEach((v) => { if (v.categoria === nombre) v.categoria = '' })
    cambio()
  })

  lista.addEventListener('input', (e) => {
    const campo = e.target.dataset.campo
    if (!campo) return
    const v = estado.videos[indice(e.target)]
    v[campo] = e.target.type === 'checkbox' ? !e.target.checked : e.target.value
    if (campo === 'titulo') alCambiar() // sin repintar, para no perder el foco
    else cambio()
  })
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]')
    if (!b) return
    const i = indice(b)
    const accion = b.dataset.accion
    if (accion === 'subir' && i > 0) mover(i, i - 1)
    if (accion === 'bajar' && i < estado.videos.length - 1) mover(i, i + 1)
    if (accion === 'borrar' && confirm('¿Borrar este video del portafolio?')) estado.videos.splice(i, 1)
    cambio()
  })

  const indice = (el) => Number(el.closest('li').dataset.i)
  const mover = (de, a) => estado.videos.splice(a, 0, estado.videos.splice(de, 1)[0])

  activarArrastre(lista, (orden) => {
    estado.videos = orden.map((i) => estado.videos[i])
    cambio()
  })

  function pintar() {
    chips.innerHTML = estado.categorias.length
      ? estado.categorias.map((c) => `<li>${escapar(c)} <button type="button" data-borrar-cat="${escapar(c)}" aria-label="Borrar categoría ${escapar(c)}">✕</button></li>`).join('')
      : '<li class="chip-vacio">Crea tu primera categoría (ej: Comerciales, Producto, Restaurantes)</li>'

    $('[data-vacio]').hidden = estado.videos.length > 0
    const opciones = (actual) => ['', ...estado.categorias]
      .map((c) => `<option value="${escapar(c)}" ${c === actual ? 'selected' : ''}>${c ? escapar(c) : 'Sin categoría'}</option>`)
      .join('')

    lista.innerHTML = estado.videos.map((v, i) => `
      <li data-i="${i}" class="${v.oculto ? 'oculto' : ''}">
        <button type="button" class="asa" data-arrastrar aria-label="Arrastrar para ordenar">⠿</button>
        <img src="${miniatura(v.id)}" alt="" loading="lazy" class="${v.formato}" />
        <div class="campos">
          <input type="text" data-campo="titulo" value="${escapar(v.titulo)}" placeholder="Título del video" aria-label="Título" maxlength="80" />
          <div class="fila-campos">
            <select data-campo="categoria" aria-label="Categoría">${opciones(v.categoria)}</select>
            <select data-campo="formato" aria-label="Formato">
              <option value="vertical" ${v.formato === 'vertical' ? 'selected' : ''}>Vertical</option>
              <option value="horizontal" ${v.formato === 'horizontal' ? 'selected' : ''}>Horizontal</option>
            </select>
          </div>
          <div class="fila-campos">
            <label class="switch"><input type="checkbox" data-campo="oculto" ${v.oculto ? '' : 'checked'} /> Visible</label>
            <span class="flechas">
              <button type="button" data-accion="subir" aria-label="Subir">↑</button>
              <button type="button" data-accion="bajar" aria-label="Bajar">↓</button>
              <button type="button" data-accion="borrar" class="peligro" aria-label="Borrar video">Borrar</button>
            </span>
          </div>
        </div>
      </li>`).join('')
  }

  pintar()
  return { datos: () => estado }
}

// Arrastrar con el dedo o el mouse desde el asa ⠿. Al soltar, entrega el nuevo orden.
function activarArrastre(lista, alSoltar) {
  let fila = null
  lista.addEventListener('pointerdown', (e) => {
    const asa = e.target.closest('[data-arrastrar]')
    if (!asa) return
    e.preventDefault()
    fila = asa.closest('li')
    fila.classList.add('arrastrando')
    asa.setPointerCapture(e.pointerId)
  })
  lista.addEventListener('pointermove', (e) => {
    if (!fila) return
    const debajo = document.elementFromPoint(e.clientX, e.clientY)?.closest('.lista > li')
    if (!debajo || debajo === fila) return
    const r = debajo.getBoundingClientRect()
    lista.insertBefore(fila, e.clientY < r.top + r.height / 2 ? debajo : debajo.nextSibling)
  })
  const soltar = () => {
    if (!fila) return
    fila.classList.remove('arrastrando')
    fila = null
    alSoltar([...lista.children].map((li) => Number(li.dataset.i)))
  }
  lista.addEventListener('pointerup', soltar)
  lista.addEventListener('pointercancel', soltar)
}
