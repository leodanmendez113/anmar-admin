import { readFile, writeFile, rename, mkdir, readdir, rm, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { CONFIG } from './config.js'

// ---------- Fotos ----------
// Solo se aceptan JPEG y WebP, revisando los primeros bytes del archivo (no el nombre).
export const NOMBRE_FOTO = /^[a-f0-9]{24}\.(webp|jpg)$/

function tipoDeImagen(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

// Cada foto se guarda en dos tamaños: la grande (nombre.webp) y una chica para el mosaico
// (nombre-m.webp). Devuelve el nombre, o null si alguna de las dos no es una imagen válida.
export const nombreChico = (nombre) => nombre.replace(/\.(webp|jpg)$/, '-m.$1')

export async function guardarFoto(carpeta, grande, chica) {
  const tipo = tipoDeImagen(grande)
  if (!tipo || tipoDeImagen(chica) !== tipo) return null
  const dir = join(CONFIG.media, carpeta)
  await mkdir(dir, { recursive: true })
  const nombre = `${randomBytes(12).toString('hex')}.${tipo}`
  await writeFile(join(dir, nombreChico(nombre)), chica)
  await writeFile(join(dir, nombre), grande)
  return nombre
}

export async function borrarFoto(carpeta, nombre) {
  if (!NOMBRE_FOTO.test(nombre)) return false
  await rm(join(CONFIG.media, carpeta, nombre), { force: true })
  await rm(join(CONFIG.media, carpeta, nombreChico(nombre)), { force: true })
  return true
}

const ruta = (nombre) => join(CONFIG.datos, `${nombre}.json`)

export async function leer(nombre) {
  return JSON.parse(await readFile(ruta(nombre), 'utf8'))
}

// Guarda de forma segura: primero copia la versión anterior al historial, después escribe
// en un archivo temporal y lo renombra (así nunca queda un archivo a medio escribir).
export async function guardar(nombre, datos) {
  const historial = join(CONFIG.datos, 'historial')
  await mkdir(historial, { recursive: true })
  const marca = new Date().toISOString().replace(/[:.]/g, '-')
  await copyFile(ruta(nombre), join(historial, `${nombre}.${marca}.json`)).catch(() => {})
  await limpiarHistorial(historial, nombre)

  const tmp = `${ruta(nombre)}.tmp`
  await writeFile(tmp, JSON.stringify(datos, null, 2) + '\n')
  await rename(tmp, ruta(nombre))
}

async function limpiarHistorial(carpeta, nombre) {
  const versiones = (await readdir(carpeta)).filter((f) => f.startsWith(`${nombre}.`)).sort()
  const sobran = versiones.slice(0, Math.max(0, versiones.length - CONFIG.versionesGuardadas))
  await Promise.all(sobran.map((f) => rm(join(carpeta, f))))
}
