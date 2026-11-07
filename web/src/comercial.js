import { escapar } from './api.js'

// Editor de paquetes del cotizador comercial (comercial.anmarproductions.com).
// Mientras "Mostrar paquetes" esté apagado, la web muestra "Próximamente".
export function crearComercial(contenedor, datos, alCambiar) {
  const estado = structuredClone(datos)

  function pintar() {
    contenedor.innerHTML = `
      <section class="panel">
        <label class="switch grande"><input type="checkbox" data-activo ${estado.activo ? 'checked' : ''} /> Mostrar paquetes en la web</label>
        <p class="ayuda">${estado.activo ? 'La web muestra estos paquetes.' : 'Apagado: la web muestra "Próximamente" con el botón de WhatsApp.'}</p>
      </section>
      <ol class="paquetes-ed">
        ${estado.paquetes.map((p, i) => `
          <li class="panel" data-i="${i}">
            <div class="fila-campos">
              <input type="text" data-campo="nombre" value="${escapar(p.nombre)}" placeholder="Nombre (ej: Reel para negocio)" aria-label="Nombre del paquete" maxlength="40" />
              <input class="precio" type="number" inputmode="numeric" min="0" step="1" data-campo="precio" value="${p.precio}" aria-label="Precio en USD" />
            </div>
            <input type="text" data-campo="descripcion" value="${escapar(p.descripcion)}" placeholder="Descripción corta" aria-label="Descripción" maxlength="160" />
            <label for="inc-${i}">Incluye (uno por línea)</label>
            <textarea id="inc-${i}" rows="4" data-campo="incluye" placeholder="1 hora de grabación&#10;2 reels verticales&#10;Música con licencia">${escapar(p.incluye.join('\n'))}</textarea>
            <div class="fila-campos">
              <label class="switch"><input type="checkbox" data-campo="destacado" ${p.destacado ? 'checked' : ''} /> Destacado</label>
              <span class="flechas">
                <button type="button" data-accion="subir" aria-label="Subir">↑</button>
                <button type="button" data-accion="bajar" aria-label="Bajar">↓</button>
                <button type="button" data-accion="borrar" class="peligro">Borrar</button>
              </span>
            </div>
          </li>`).join('')}
      </ol>
      ${estado.paquetes.length < 12 ? '<button class="boton secundario" type="button" data-agregar>+ Agregar paquete</button>' : ''}`
  }

  contenedor.addEventListener('input', (e) => {
    if (e.target.matches('[data-activo]')) { estado.activo = e.target.checked; pintar(); alCambiar(); return }
    const campo = e.target.dataset.campo
    if (!campo) return
    const p = estado.paquetes[Number(e.target.closest('[data-i]').dataset.i)]
    if (campo === 'precio') p.precio = Math.max(0, Math.round(Number(e.target.value) || 0))
    else if (campo === 'destacado') p.destacado = e.target.checked
    else if (campo === 'incluye') p.incluye = e.target.value.split('\n')
    else p[campo] = e.target.value
    alCambiar()
  })

  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('[data-agregar]')) {
      estado.paquetes.push({ nombre: '', descripcion: '', precio: 0, destacado: false, incluye: [] })
      pintar(); alCambiar()
      contenedor.querySelector('.paquetes-ed li:last-child input')?.focus()
      return
    }
    const b = e.target.closest('[data-accion]')
    if (!b) return
    const i = Number(b.closest('[data-i]').dataset.i)
    const lista = estado.paquetes
    if (b.dataset.accion === 'subir' && i > 0) lista.splice(i - 1, 0, lista.splice(i, 1)[0])
    if (b.dataset.accion === 'bajar' && i < lista.length - 1) lista.splice(i + 1, 0, lista.splice(i, 1)[0])
    if (b.dataset.accion === 'borrar' && confirm('¿Borrar este paquete?')) lista.splice(i, 1)
    pintar(); alCambiar()
  })

  pintar()
  return { datos: () => estado }
}
