import { readFile, writeFile, rename, mkdir, readdir, rm, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CONFIG } from './config.js'

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
