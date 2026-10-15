/**
 * Operador de acompañamiento (Capa 1) — persona real con nombre y foto.
 * Tono: profesional, cercano y calmado. Nunca rompe el personaje:
 * es un operador humano de CuidaChile, no una IA.
 * Todo simulado en el MVP: sin backend, sin operador humano real.
 */

// ── Constantes configurables para la demo ────────────────────────────────
// Nombre que ve el usuario en el header del chat.
export const OPERADOR_NOMBRE = 'Cristián'

// Foto de perfil del operador (avatar local, funciona sin internet).
export const FOTO_OPERADOR = '/img/operador.svg'

// Tiempo que el operador tarda en responder (simula que está escribiendo).
export const TIEMPO_RESPUESTA_OPERADOR = 1500

// Primer mensaje automático al iniciar una Ruta Segura.
export const MENSAJE_BIENVENIDA_OPERADOR =
  '¡Hola! Soy Cristián, operador de CuidaChile. Te voy a acompañar durante tu ruta. ¿Cómo estuvo tu día?'

// Despedida al finalizar la ruta.
export const MENSAJE_FIN_RUTA_OPERADOR =
  '¡Perfecto, llegaste bien! Me alegra haberte acompañado. Quedo atento para tu próxima ruta.'

// Respuesta cuando el usuario menciona peligro: ofrece activar el SOS.
export const MENSAJE_PELIGRO_OPERADOR =
  'Entiendo. Si sientes que estás en peligro, puedo activar el modo SOS y avisar a tus contactos de inmediato. ¿Quieres que lo active?'

export interface RespuestaOperador {
  texto: string
  /** true → el mensaje muestra botón directo al SOS. */
  sugiereSOS: boolean
}

// Palabras que activan la sugerencia de SOS (se normalizan sin tildes).
const PALABRAS_PELIGRO = [
  'miedo', 'peligro', 'peligrosa', 'peligroso', 'auxilio', 'ayuda',
  'socorro', 'persigu', 'siguen', 'sigue', 'sospechoso', 'sospechosa',
  'raro', 'rara', 'acoso', 'acosan', 'acosando', 'atacan', 'ataco',
  'robo', 'robar', 'asalto', 'asalt', 'emergencia',
]

// Respuestas genéricas para rotar cuando no hay palabra clave.
const RESPUESTAS_GENERICAS = [
  'Te escucho, sigue nomás. Sigo atento a tu ruta.',
  'Entiendo. ¿Algo más que me quieras contar del viaje?',
  'Bien, sigo en línea contigo. ¿A qué hora estimas llegar?',
  'Perfecto, quedo atento. Cualquier cosa me avisas de inmediato.',
]

/** Minúsculas + sin tildes para comparar sin importar cómo escriba. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** true si el mensaje sugiere que la persona puede estar en peligro. */
export function detectarPeligro(texto: string): boolean {
  const n = normalizar(texto)
  return PALABRAS_PELIGRO.some((p) => n.includes(p))
}

/** Respuesta del operador según palabras clave (reglas simples del MVP). */
export function responderOperador(texto: string): RespuestaOperador {
  const n = normalizar(texto)

  // Peligro primero: siempre tiene prioridad.
  if (detectarPeligro(texto)) {
    return { texto: MENSAJE_PELIGRO_OPERADOR, sugiereSOS: true }
  }
  if (/(bien|bacan|buen dia|buen-dia|genial|feliz|contento|contenta|alegre)/.test(n)) {
    return { texto: 'Me alegra escucharlo. ¿Hacia dónde te diriges?', sugiereSOS: false }
  }
  if (/(cansad|agotad|fome|estresad|estres|pajero|paja|tenso|tensa)/.test(n)) {
    return { texto: 'Te entiendo, los días largos agotan. Ya falta menos para descansar en casa. ¿Cuánto te falta para llegar?', sugiereSOS: false }
  }
  if (/(musica|cancion|playlist|spotify|escuchando)/.test(n)) {
    return { texto: 'Buena compañía la música para el camino. ¿Qué vas escuchando?', sugiereSOS: false }
  }
  if (/(clima|frio|calor|lluvia|lloviendo|helado|nublado|sol)/.test(n)) {
    return { texto: 'Sí, el clima está cambiante. Lo importante es que ya vas en camino.', sugiereSOS: false }
  }
  if (/(micro|bus|metro|auto|taxi|uber|caminando|bici|camioneta)/.test(n)) {
    return { texto: 'Perfecto, yo me quedo en línea contigo hasta que llegues.', sugiereSOS: false }
  }
  if (/(gracias|vale|bkn|buena onda)/.test(n)) {
    return { texto: 'Con gusto, para eso estamos.', sugiereSOS: false }
  }
  if (/(hola|buenas|buenos dias|buenas tardes|buenas noches|wena)/.test(n)) {
    return { texto: '¡Hola! Qué bueno saber de ti. ¿Cómo va el viaje?', sugiereSOS: false }
  }
  if (/(mal|triste|pena|llorar|depre|ansios|nervios)/.test(n)) {
    return { texto: 'Lamento escuchar eso. Estoy aquí para acompañarte, cuéntame lo que necesites.', sugiereSOS: false }
  }
  // Sin palabra clave: rota una genérica para no sonar repetitivo.
  const i = Math.floor(Math.random() * RESPUESTAS_GENERICAS.length)
  return { texto: RESPUESTAS_GENERICAS[i], sugiereSOS: false }
}
