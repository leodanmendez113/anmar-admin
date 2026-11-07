// Llamadas a la API del admin. La sesión viaja en una cookie que el navegador maneja solo.
async function pedir(ruta, opciones = {}) {
  const r = await fetch(`/api${ruta}`, {
    ...opciones,
    credentials: 'same-origin',
    headers: opciones.body ? { 'Content-Type': 'application/json' } : {}
  })
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) {
    const error = new Error(cuerpo.error || `Error ${r.status}`)
    error.estado = r.status
    throw error
  }
  return cuerpo
}

export const api = {
  sesion: () => pedir('/sesion'),
  entrar: (usuario, clave, turnstile) => pedir('/login', { method: 'POST', body: JSON.stringify({ usuario, clave, turnstile }) }),
  salir: () => pedir('/logout', { method: 'POST' }),
  leer: (nombre) => pedir(`/datos/${nombre}`),
  guardar: (nombre, datos) => pedir(`/datos/${nombre}`, { method: 'PUT', body: JSON.stringify(datos) }),
  subirFoto: (base64, chica) => pedir('/media/bodas', { method: 'POST', body: JSON.stringify({ datos: base64, chica }) }),
  borrarFoto: (archivo) => pedir(`/media/bodas/${encodeURIComponent(archivo)}`, { method: 'DELETE' })
}

export const escapar = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
