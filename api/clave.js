// Guarda el usuario y la contraseña cifrada del admin.
// Lo llama el comando `anmar-clave` (servidor/anmar-clave.sh), que pide los datos en la terminal
// y los pasa por la entrada estándar: primera línea el usuario, segunda la contraseña.
// La contraseña nunca se guarda en texto plano.
import { writeFileSync, chmodSync, readFileSync } from 'node:fs'
import { cifrarClave } from './sesiones.js'
import { CONFIG } from './config.js'

const salir = (mensaje) => { console.error(mensaje); process.exit(1) }

let entrada = ''
try {
  entrada = readFileSync(0, 'utf8')
} catch {
  salir('No llegaron datos. Usa el comando anmar-clave.')
}
const [usuario = '', clave = ''] = entrada.replace(/\r/g, '').split('\n')

if (!/^[\w.-]{3,30}$/.test(usuario.trim())) salir('Usuario inválido: usa letras, números, punto o guion (3 a 30). No se guardó nada.')
if (clave.length < 10) salir('La contraseña es muy corta (mínimo 10 caracteres). No se guardó nada.')

writeFileSync(CONFIG.credenciales, JSON.stringify({ usuario: usuario.trim(), hash: cifrarClave(clave) }, null, 2) + '\n')
chmodSync(CONFIG.credenciales, 0o600)
console.log(`Listo. Usuario "${usuario.trim()}" guardado. Ya puedes entrar a https://admin.anmarproductions.com`)
