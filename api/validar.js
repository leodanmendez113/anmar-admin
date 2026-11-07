// Revisa que los datos tengan la forma correcta antes de guardarlos.
// Devuelve { ok: true, datos } con los datos limpios, o { ok: false, error } con un mensaje en español.

const texto = (v, max) => typeof v === 'string' && v.length <= max
const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
const falla = (error) => ({ ok: false, error })

function videos(d) {
  if (!d || !Array.isArray(d.categorias) || !Array.isArray(d.videos)) return falla('Formato de videos inválido.')
  if (d.categorias.length > 30 || !d.categorias.every((c) => texto(c, 30) && c.trim())) return falla('Categorías inválidas (máx. 30, de hasta 30 letras).')
  if (d.videos.length > 300) return falla('Máximo 300 videos.')
  const ids = new Set()
  for (const v of d.videos) {
    if (!/^[\w-]{11}$/.test(v?.id)) return falla('Hay un video con un ID de YouTube inválido.')
    if (ids.has(v.id)) return falla('Hay un video repetido.')
    ids.add(v.id)
    if (!texto(v.titulo, 80)) return falla('Hay un título demasiado largo (máx. 80).')
    if (v.categoria !== '' && !d.categorias.includes(v.categoria)) return falla(`La categoría "${v.categoria}" no existe.`)
    if (!['vertical', 'horizontal'].includes(v.formato)) return falla('Formato de video inválido.')
    if (typeof v.oculto !== 'boolean') return falla('Valor "oculto" inválido.')
  }
  return {
    ok: true,
    datos: {
      categorias: d.categorias.map((c) => c.trim()),
      videos: d.videos.map(({ id, titulo, categoria, formato, oculto }) => ({ id, titulo: titulo.trim(), categoria, formato, oculto }))
    }
  }
}

function preciosEventos(d) {
  if (!d || !Array.isArray(d.tabla) || d.tabla.length !== 12) return falla('La tabla debe tener 12 filas (1 a 12 horas).')
  for (const [i, fila] of d.tabla.entries()) {
    if (!Array.isArray(fila) || fila.length !== 4 || fila[0] !== i + 1) return falla(`Fila ${i + 1} inválida.`)
    if (!fila.slice(1).every((p) => entero(p, 0, 100000))) return falla(`Precio inválido en ${i + 1} h (enteros de 0 a 100000).`)
  }
  for (const campo of ['fotosPorHora', 'fotosPaso', 'precioPaso', 'fotosExtraMax']) {
    if (!entero(d[campo], 0, 10000)) return falla(`Valor inválido en "${campo}".`)
  }
  if (d.fotosPaso === 0) return falla('"Fotos por paso" no puede ser 0.')
  const { tabla, fotosPorHora, fotosPaso, precioPaso, fotosExtraMax } = d
  return { ok: true, datos: { tabla, fotosPorHora, fotosPaso, precioPaso, fotosExtraMax } }
}

function preciosComercial(d) {
  if (!d || typeof d.activo !== 'boolean' || !Array.isArray(d.paquetes)) return falla('Formato de paquetes inválido.')
  if (d.paquetes.length > 12) return falla('Máximo 12 paquetes.')
  for (const p of d.paquetes) {
    if (!texto(p?.nombre, 40) || !p.nombre.trim()) return falla('Cada paquete necesita un nombre (máx. 40).')
    if (!texto(p.descripcion, 160)) return falla('Descripción demasiado larga (máx. 160).')
    if (!entero(p.precio, 0, 1000000)) return falla(`Precio inválido en "${p.nombre}".`)
    if (typeof p.destacado !== 'boolean') return falla('Valor "destacado" inválido.')
    if (!Array.isArray(p.incluye) || p.incluye.length > 12 || !p.incluye.every((x) => texto(x, 80))) return falla(`Lista "incluye" inválida en "${p.nombre}".`)
  }
  return {
    ok: true,
    datos: {
      activo: d.activo,
      paquetes: d.paquetes.map((p) => ({
        nombre: p.nombre.trim(), descripcion: p.descripcion.trim(), precio: p.precio,
        destacado: p.destacado, incluye: p.incluye.map((x) => x.trim()).filter(Boolean)
      }))
    }
  }
}

export const VALIDADORES = {
  videos,
  'precios-eventos': preciosEventos,
  'precios-comercial': preciosComercial
}
