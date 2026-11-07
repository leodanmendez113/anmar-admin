// Prepara una foto en el propio navegador antes de subirla, en dos tamaños: grande (máx. 2000 px,
// para portada y visor) y chica (800 px, para el mosaico). Las convierte a WebP (o JPEG si el
// navegador no sabe hacer WebP, como Safari). Así una foto de 8 MB del celular sube como ~300 KB
// y el servidor no necesita programas extra.

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolver(img) }
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error(`No se pudo abrir "${archivo.name}". Prueba con una foto JPG.`)) }
    img.src = url
  })
}

const aBlob = (canvas, tipo, calidad) => new Promise((r) => canvas.toBlob(r, tipo, calidad))

async function reducir(img, ladoMax, calidad) {
  const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight))
  const ancho = Math.round(img.naturalWidth * escala)
  const alto = Math.round(img.naturalHeight * escala)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto)

  let blob = await aBlob(canvas, 'image/webp', calidad)
  if (!blob || blob.type !== 'image/webp') blob = await aBlob(canvas, 'image/jpeg', calidad + 0.03)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { base64: btoa(binario), ancho, alto }
}

export async function prepararFoto(archivo) {
  const img = await cargarImagen(archivo)
  const grande = await reducir(img, 2000, 0.82)
  const chica = await reducir(img, 800, 0.78)
  return { base64: grande.base64, chica: chica.base64, ancho: grande.ancho, alto: grande.alto }
}
