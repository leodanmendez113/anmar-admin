import { escapar } from './api.js'

// Editor de datos de contacto: WhatsApp, email, redes y los mensajes que vienen escritos
// al abrir WhatsApp desde cada web. Lo usan portafolio, eventos y comercial.
const CAMPOS = [
  { id: 'whatsapp', etiqueta: 'WhatsApp', tipo: 'tel', ayuda: 'Con código de país, sin espacios. Ej: 13055551234', placeholder: '13055551234' },
  { id: 'email', etiqueta: 'Email', tipo: 'email', ayuda: 'Aparece en el pie de las 3 webs. Vacío = no se muestra.', placeholder: 'hola@anmarproductions.com' },
  { id: 'instagram', etiqueta: 'Instagram', tipo: 'text', ayuda: 'Solo el usuario, sin @. Vacío = no se muestra.', placeholder: 'anmarproductions' },
  { id: 'tiktok', etiqueta: 'TikTok', tipo: 'text', ayuda: 'Solo el usuario, sin @. Vacío = no se muestra.', placeholder: 'anmarproductions' },
  { id: 'youtube', etiqueta: 'YouTube', tipo: 'url', ayuda: 'Link completo del canal. Vacío = no se muestra.', placeholder: 'https://www.youtube.com/@anmar' }
]
const MENSAJES = [
  { id: 'portafolio', etiqueta: 'Mensaje desde el portafolio' },
  { id: 'eventos', etiqueta: 'Primera línea desde eventos', ayuda: 'Debajo se agregan solos el servicio, las horas, las fotos y el total.' },
  { id: 'comercial', etiqueta: 'Mensaje desde comercial', ayuda: 'Los botones de cada paquete agregan solos el nombre y el precio.' }
]

export function crearContacto(contenedor, datos, alCambiar) {
  const estado = structuredClone(datos)

  contenedor.innerHTML = `
    <p class="ayuda">Estos datos se usan en las 3 webs. Se ven apenas tocas "Guardar".</p>
    <section class="panel contacto">
      ${CAMPOS.map((c) => `
        <label for="c-${c.id}">${c.etiqueta}</label>
        <input id="c-${c.id}" type="${c.tipo}" data-campo="${c.id}" value="${escapar(estado[c.id])}" placeholder="${c.placeholder}"
          ${c.tipo === 'tel' ? 'inputmode="numeric"' : ''} autocomplete="off" autocapitalize="none" spellcheck="false" />
        <small>${c.ayuda}</small>`).join('')}
    </section>
    <section class="panel contacto">
      <h2>Mensajes de WhatsApp</h2>
      ${MENSAJES.map((m) => `
        <label for="m-${m.id}">${m.etiqueta}</label>
        <textarea id="m-${m.id}" rows="3" maxlength="300" data-mensaje="${m.id}">${escapar(estado.mensajes[m.id])}</textarea>
        ${m.ayuda ? `<small>${m.ayuda}</small>` : ''}`).join('')}
      <a class="boton secundario" data-probar target="_blank" rel="noopener">Probar WhatsApp →</a>
    </section>`

  const probar = contenedor.querySelector('[data-probar]')
  const actualizarPrueba = () => {
    const numero = String(estado.whatsapp).replace(/\D/g, '')
    probar.href = `https://wa.me/${numero}?text=${encodeURIComponent(estado.mensajes.portafolio)}`
  }

  contenedor.addEventListener('input', (e) => {
    const { campo, mensaje } = e.target.dataset
    if (campo) estado[campo] = e.target.value
    else if (mensaje) estado.mensajes[mensaje] = e.target.value
    else return
    actualizarPrueba()
    alCambiar()
  })

  actualizarPrueba()
  return { datos: () => estado }
}
