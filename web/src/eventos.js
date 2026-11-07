// Editor de precios del cotizador de eventos (eventos.anmarproductions.com).
// Tabla de 1 a 12 horas × Foto / Video / Foto + Video, más las reglas de fotos extra.
const COLUMNAS = ['Foto', 'Video', 'Foto + Video']
const REGLAS = [
  ['fotosPorHora', 'Fotos incluidas por hora'],
  ['fotosPaso', 'Fotos extra por paso'],
  ['precioPaso', 'Precio de cada paso (USD)'],
  ['fotosExtraMax', 'Máximo de fotos extra']
]

export function crearEventos(contenedor, datos, alCambiar) {
  const estado = structuredClone(datos)
  const numero = (campo, valor, etiqueta) =>
    `<input type="number" inputmode="numeric" min="0" step="1" value="${valor}" data-campo="${campo}" aria-label="${etiqueta}" />`

  contenedor.innerHTML = `
    <p class="ayuda">Precios en dólares, sin centavos. Los cambios se ven en la web apenas tocas "Guardar".</p>
    <section class="panel tabla-precios">
      <div class="tp-fila tp-cab"><span>Horas</span>${COLUMNAS.map((c) => `<span>${c}</span>`).join('')}</div>
      ${estado.tabla.map(([h, ...precios], i) => `
        <div class="tp-fila">
          <span class="tp-horas">${h} h</span>
          ${precios.map((p, j) => numero(`tabla.${i}.${j + 1}`, p, `${COLUMNAS[j]}, ${h} horas`)).join('')}
        </div>`).join('')}
    </section>
    <section class="panel reglas">
      <h2>Fotos extra (modo Personalizado)</h2>
      ${REGLAS.map(([campo, texto]) => `<label class="regla"><span>${texto}</span>${numero(campo, estado[campo], texto)}</label>`).join('')}
      <p class="ayuda" data-resumen></p>
    </section>`

  const resumen = () => {
    contenedor.querySelector('[data-resumen]').textContent =
      `Hoy: cada ${estado.fotosPaso} fotos extra suman $${estado.precioPaso}, hasta ${estado.fotosExtraMax} extra.`
  }

  contenedor.addEventListener('input', (e) => {
    const campo = e.target.dataset.campo
    if (!campo) return
    const valor = Math.max(0, Math.round(Number(e.target.value) || 0))
    const partes = campo.split('.')
    if (partes[0] === 'tabla') estado.tabla[partes[1]][partes[2]] = valor
    else estado[campo] = valor
    resumen()
    alCambiar()
  })

  resumen()
  return { datos: () => estado }
}
