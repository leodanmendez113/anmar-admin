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

function contacto(d) {
  if (!d || typeof d !== 'object' || !d.mensajes || typeof d.mensajes !== 'object') return falla('Formato de contacto inválido.')
  const limpio = (v) => (typeof v === 'string' ? v.trim() : v)
  const whatsapp = String(limpio(d.whatsapp) ?? '').replace(/[\s()+-]/g, '')
  const email = limpio(d.email) ?? ''
  const instagram = String(limpio(d.instagram) ?? '').replace(/^@/, '')
  const tiktok = String(limpio(d.tiktok) ?? '').replace(/^@/, '')
  const youtube = limpio(d.youtube) ?? ''

  if (!/^\d{8,15}$/.test(whatsapp)) return falla('El WhatsApp tiene que ser el número con código de país, solo dígitos (8 a 15). Ej: 13055551234.')
  if (email && (!texto(email, 100) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) return falla('El email no es válido.')
  if (instagram && !/^[\w.]{1,30}$/.test(instagram)) return falla('El usuario de Instagram no es válido (letras, números, punto o guion bajo).')
  if (tiktok && !/^[\w.]{1,30}$/.test(tiktok)) return falla('El usuario de TikTok no es válido (letras, números, punto o guion bajo).')
  if (youtube && (!texto(youtube, 200) || !/^https:\/\/(www\.|m\.)?youtube\.com\/\S+$/.test(youtube))) return falla('El link de YouTube tiene que empezar con https://youtube.com/ o https://www.youtube.com/.')

  const mensajes = {}
  for (const sitio of ['portafolio', 'eventos', 'comercial']) {
    const m = limpio(d.mensajes[sitio])
    if (!texto(m, 300) || !m) return falla(`El mensaje de WhatsApp de ${sitio} es obligatorio (máx. 300 caracteres).`)
    mensajes[sitio] = m
  }
  // Bodas es opcional: si queda vacío, la web usa su mensaje por defecto.
  const bodas = limpio(d.mensajes.bodas) ?? ''
  if (!texto(bodas, 300)) return falla('El mensaje de WhatsApp de bodas es demasiado largo (máx. 300).')
  if (bodas) mensajes.bodas = bodas
  return { ok: true, datos: { whatsapp, email, instagram, tiktok, youtube, mensajes } }
}

const ID_VIDEO = { vimeo: /^\d{6,12}$/, youtube: /^[\w-]{11}$/ }
const MINIATURA = /^https:\/\/(i\.vimeocdn\.com|i\.ytimg\.com)\/\S{1,280}$/
const FOTO = /^[a-f0-9]{24}\.(webp|jpg)$/

function bodas(d) {
  if (!d || !Array.isArray(d.peliculas) || !Array.isArray(d.fotos) || typeof d.portada !== 'string') return falla('Formato de bodas inválido.')
  if (d.peliculas.length > 60) return falla('Máximo 60 películas.')
  if (d.fotos.length > 300) return falla('Máximo 300 fotos.')

  const ids = new Set()
  for (const p of d.peliculas) {
    if (!ID_VIDEO[p?.plataforma]?.test(p.id)) return falla('Hay una película con un link de Vimeo o YouTube inválido.')
    if (ids.has(p.plataforma + p.id)) return falla('Hay una película repetida.')
    ids.add(p.plataforma + p.id)
    if (!texto(p.pareja, 60) || !texto(p.lugar, 60)) return falla('Nombre de la pareja o lugar demasiado largo (máx. 60).')
    if (p.miniatura !== '' && !MINIATURA.test(p.miniatura)) return falla('Miniatura de película inválida.')
    if (typeof p.destacada !== 'boolean' || typeof p.oculto !== 'boolean') return falla('Valores de película inválidos.')
  }
  if (d.peliculas.filter((p) => p.destacada).length > 1) return falla('Solo puede haber una película destacada.')

  const archivos = new Set()
  for (const f of d.fotos) {
    if (!FOTO.test(f?.archivo)) return falla('Hay una foto con un nombre de archivo inválido.')
    if (archivos.has(f.archivo)) return falla('Hay una foto repetida.')
    archivos.add(f.archivo)
    if (!entero(f.ancho, 1, 10000) || !entero(f.alto, 1, 10000)) return falla('Medidas de foto inválidas.')
    if (typeof f.oculto !== 'boolean') return falla('Valor "oculto" de foto inválido.')
  }
  if (d.portada && !archivos.has(d.portada)) return falla('La foto de portada no está en la lista de fotos.')

  return {
    ok: true,
    datos: {
      portada: d.portada,
      peliculas: d.peliculas.map(({ plataforma, id, pareja, lugar, miniatura, destacada, oculto }) =>
        ({ plataforma, id, pareja: pareja.trim(), lugar: lugar.trim(), miniatura, destacada, oculto })),
      fotos: d.fotos.map(({ archivo, ancho, alto, oculto }) => ({ archivo, ancho, alto, oculto }))
    }
  }
}

export const VALIDADORES = {
  videos,
  'precios-eventos': preciosEventos,
  'precios-comercial': preciosComercial,
  contacto,
  bodas
}
