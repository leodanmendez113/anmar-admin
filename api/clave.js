// Crea o cambia el usuario y la contraseña del admin.
// En el VPS se usa con el comando `anmar-clave` (lo instala servidor/instalar.sh).
// La contraseña se escribe sin mostrarse en pantalla y nunca se guarda en texto plano.
import { writeFileSync, chmodSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { cifrarClave } from './sesiones.js'
import { CONFIG } from './config.js'

function preguntar(texto, oculto = false) {
  return new Promise((resolver) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (oculto) rl._writeToOutput = (s) => { if (s.includes(texto)) process.stdout.write(s) }
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); resolver(r) })
  })
}

const usuario = (await preguntar('Usuario del admin (ej: angel): ')).trim()
const clave = await preguntar('Contraseña nueva (mínimo 10 caracteres): ', true)
const repetida = await preguntar('Repite la contraseña: ', true)

if (!/^[\w.-]{3,30}$/.test(usuario)) { console.error('Usuario inválido: usa letras, números, punto o guion (3 a 30).'); process.exit(1) }
if (clave.length < 10) { console.error('La contraseña es muy corta.'); process.exit(1) }
if (clave !== repetida) { console.error('Las contraseñas no coinciden.'); process.exit(1) }

writeFileSync(CONFIG.credenciales, JSON.stringify({ usuario, hash: cifrarClave(clave) }, null, 2) + '\n')
chmodSync(CONFIG.credenciales, 0o600)
console.log(`Listo. Usuario "${usuario}" guardado. Ya puedes entrar al admin.`)
