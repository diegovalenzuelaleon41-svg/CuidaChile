import { supabase } from './supabase'

export const TERMINOS_VERSION = 'v1-ley-19628-21719'

// Registro con Google: el checkbox se acepta antes del redirect de OAuth,
// así que la versión queda pendiente en sessionStorage hasta tener sesión.
export const TERMINOS_PENDIENTES_KEY = 'cuida:terminos-pendientes'

export async function guardarTerminosPendientes(uid: string) {
  let version: string | null = null
  try {
    version = sessionStorage.getItem(TERMINOS_PENDIENTES_KEY)
  } catch {
    return
  }
  if (!version) return
  const { error } = await supabase.from('perfil').update({
    terminos_version: version,
    terminos_aceptado_en: new Date().toISOString(),
  }).eq('id', uid)
  if (!error) {
    try { sessionStorage.removeItem(TERMINOS_PENDIENTES_KEY) } catch { /* noop */ }
  }
}
