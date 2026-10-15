import { create } from 'zustand'

export interface Contacto {
  id: string
  nombre: string
  telefono: string
  relacion: string
  lat?: number
  lng?: number
}

export interface RutaHistorial {
  id: string
  origen: string
  destino: string
  inicio: string
  fin?: string | null
  estado: string
}

export interface ChatMsg {
  id: string
  emisor: 'usuario' | 'operador'
  contenido: string
  creado_en: string
  /** Acción inline del mensaje (ej. el operador sugiere activar el SOS). */
  accion?: 'sugerirSOS'
}

interface RutaActiva {
  id: string
  origen: string
  destino: string
  inicioEpoch: number
  destinoLat?: number
  destinoLng?: number
}

interface SeguridadState {
  rutaActiva: RutaActiva | null
  alertaActiva: boolean
  contactos: Contacto[]
  historial: RutaHistorial[]
  mensajes: ChatMsg[]
  /** Sesión de chat atada a la ruta actual (null = sin sesión). */
  sesionId: string | null
  /** true = última sesión finalizada/expirada → chat en estado vacío. */
  sesionFinalizada: boolean
  sesionInicioEpoch: number | null
  iniciarRuta: (r: RutaActiva) => void
  finalizarRuta: () => void
  setAlerta: (v: boolean) => void
  setContactos: (c: Contacto[]) => void
  setHistorial: (h: RutaHistorial[]) => void
  pushMensaje: (m: ChatMsg) => void
  setMensajes: (m: ChatMsg[]) => void
  /** Marca la sesión como finalizada si pasó el tiempo de expiración sin actividad. */
  revisarExpiracion: () => void
}

/* ── Sesiones de chat por ruta ────────────────────────────────────────
   Cada "Iniciar Ruta Segura" crea un sessionId nuevo y vacía el chat.
   Los mensajes se guardan por sesión (no global) y al finalizar la ruta
   —o tras 12 h sin actividad— la sesión queda "Finalizada". */

const LEGACY_CHAT_KEY = 'cuidachile.chat.v1'
const SESION_KEY = 'cuidachile.chat.sesion.v1'
const keyMsgs = (id: string) => `cuidachile.chat.msgs.${id}`
/** Horas sin actividad antes de dar la sesión por finalizada. */
export const SESION_EXPIRACION_MS = 12 * 3600 * 1000

interface SesionMeta {
  sesionId: string | null
  inicioEpoch: number | null
  actividadEpoch: number | null
  finEpoch: number | null
  finalizada: boolean
}

function leerJSON<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function escribirJSON(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* noop */
  }
}

function genSesionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function estaExpirada(meta: SesionMeta, ahora = Date.now()): boolean {
  return (
    !meta.finalizada &&
    meta.actividadEpoch != null &&
    ahora - meta.actividadEpoch > SESION_EXPIRACION_MS
  )
}

function cargarInicial(): { meta: SesionMeta; mensajes: ChatMsg[] } {
  const meta = leerJSON<SesionMeta>(SESION_KEY)
  if (meta?.sesionId) {
    const msgs = leerJSON<ChatMsg[]>(keyMsgs(meta.sesionId)) ?? []
    const mensajes = Array.isArray(msgs) ? msgs : []
    if (estaExpirada(meta)) {
      const cerrada: SesionMeta = { ...meta, finalizada: true, finEpoch: Date.now() }
      escribirJSON(SESION_KEY, cerrada)
      return { meta: cerrada, mensajes }
    }
    return { meta, mensajes }
  }
  // Migración: mensajes globales antiguos → historial de sesión finalizada.
  const legacy = leerJSON<ChatMsg[]>(LEGACY_CHAT_KEY)
  if (Array.isArray(legacy) && legacy.length > 0) {
    const m: SesionMeta = {
      sesionId: 'legacy',
      inicioEpoch: null,
      actividadEpoch: null,
      finEpoch: Date.now(),
      finalizada: true,
    }
    escribirJSON(SESION_KEY, m)
    escribirJSON(keyMsgs('legacy'), legacy)
    try {
      localStorage.removeItem(LEGACY_CHAT_KEY)
    } catch {
      /* noop */
    }
    return { meta: m, mensajes: legacy }
  }
  const vacia: SesionMeta = {
    sesionId: null,
    inicioEpoch: null,
    actividadEpoch: null,
    finEpoch: null,
    finalizada: false,
  }
  return { meta: vacia, mensajes: [] }
}

const inicial = cargarInicial()

export const useSeguridad = create<SeguridadState>((set, get) => ({
  rutaActiva: null,
  alertaActiva: false,
  contactos: [],
  historial: [],
  mensajes: inicial.mensajes,
  sesionId: inicial.meta.sesionId,
  sesionFinalizada: inicial.meta.finalizada,
  sesionInicioEpoch: inicial.meta.inicioEpoch,
  iniciarRuta: (r) => {
    // Nueva sesión: sessionId fresco + chat vacío.
    const sesionId = genSesionId()
    const ahora = Date.now()
    const meta: SesionMeta = {
      sesionId,
      inicioEpoch: ahora,
      actividadEpoch: ahora,
      finEpoch: null,
      finalizada: false,
    }
    escribirJSON(SESION_KEY, meta)
    escribirJSON(keyMsgs(sesionId), [])
    set({
      rutaActiva: r,
      mensajes: [],
      sesionId,
      sesionFinalizada: false,
      sesionInicioEpoch: ahora,
    })
  },
  finalizarRuta: () => {
    const { sesionId } = get()
    if (sesionId) {
      const meta = leerJSON<SesionMeta>(SESION_KEY)
      if (meta && meta.sesionId === sesionId) {
        escribirJSON(SESION_KEY, {
          ...meta,
          finalizada: true,
          finEpoch: Date.now(),
        })
      }
    }
    set({ rutaActiva: null, sesionFinalizada: true })
  },
  setAlerta: (v) => set({ alertaActiva: v }),
  setContactos: (c) => set({ contactos: c }),
  setHistorial: (h) => set({ historial: h }),
  pushMensaje: (m) => {
    const { mensajes, sesionId } = get()
    const next = [...mensajes, m]
    if (sesionId) {
      escribirJSON(keyMsgs(sesionId), next)
      const meta = leerJSON<SesionMeta>(SESION_KEY)
      if (meta && meta.sesionId === sesionId && !meta.finalizada) {
        escribirJSON(SESION_KEY, { ...meta, actividadEpoch: Date.now() })
      }
    }
    set({ mensajes: next })
  },
  setMensajes: (m) => set({ mensajes: m }),
  revisarExpiracion: () => {
    const { sesionId, sesionFinalizada } = get()
    if (!sesionId || sesionFinalizada) return
    const meta = leerJSON<SesionMeta>(SESION_KEY)
    if (meta && meta.sesionId === sesionId && estaExpirada(meta)) {
      escribirJSON(SESION_KEY, { ...meta, finalizada: true, finEpoch: Date.now() })
      set({ sesionFinalizada: true })
    }
  },
}))
