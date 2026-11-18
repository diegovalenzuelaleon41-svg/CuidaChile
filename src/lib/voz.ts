/**
 * Avisos hablados del SOS con la voz del navegador (speechSynthesis): sin servicios externos y sin
 * conexión. Van apagados por defecto: hablar en voz alta puede delatar a quien pide ayuda, así que
 * solo suenan si la persona lo activó en su perfil.
 */

const CLAVE = 'cuidachile.vozSOS'

export const vozDisponible = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function leerPreferenciaVoz(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

export function guardarPreferenciaVoz(activa: boolean) {
  try {
    localStorage.setItem(CLAVE, activa ? '1' : '0')
  } catch {
    /* sin almacenamiento: vale solo para esta sesión */
  }
}

/** Una voz en español, preferentemente de Chile o Latinoamérica. */
function vozEspanol(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices()
  return (
    voces.find((v) => v.lang === 'es-CL') ??
    voces.find((v) => v.lang === 'es-419' || v.lang === 'es-US' || v.lang === 'es-MX') ??
    voces.find((v) => v.lang.startsWith('es'))
  )
}

/** Dice `texto` cortando lo que estuviera diciendo antes. No hace nada si el navegador no tiene voz. */
export function hablar(texto: string) {
  if (!vozDisponible()) return
  const sintesis = window.speechSynthesis
  sintesis.cancel()
  const frase = new SpeechSynthesisUtterance(texto)
  frase.lang = 'es-CL'
  const voz = vozEspanol()
  if (voz) frase.voice = voz
  frase.rate = 1
  sintesis.speak(frase)
}

export function callar() {
  if (vozDisponible()) window.speechSynthesis.cancel()
}

/* ── Modo discreto: sin voz, sin vibración, sin sirena ni rojo en la pantalla SOS ── */

const CLAVE_DISCRETO = 'cuidachile.discreto'

export function leerModoDiscreto(): boolean {
  try {
    return localStorage.getItem(CLAVE_DISCRETO) === '1'
  } catch {
    return false
  }
}

export function guardarModoDiscreto(activo: boolean) {
  try {
    localStorage.setItem(CLAVE_DISCRETO, activo ? '1' : '0')
  } catch {
    /* sin almacenamiento: vale solo para esta sesión */
  }
}
