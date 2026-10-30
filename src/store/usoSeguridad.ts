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
  iniciarRuta: (r: RutaActiva) => void
  finalizarRuta: () => void
  setAlerta: (v: boolean) => void
  setContactos: (c: Contacto[]) => void
  setHistorial: (h: RutaHistorial[]) => void
}

/* El chat con el operador vive en Supabase (tabla mensajes). El chat simulado
   anterior guardaba sesiones en localStorage ("cuidachile.chat.*"): se
   borran una vez para no dejar conversaciones viejas en el navegador. */
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k?.startsWith('cuidachile.chat.')) localStorage.removeItem(k)
  }
} catch {
  /* sin acceso a localStorage: no hay nada que limpiar */
}

export const useSeguridad = create<SeguridadState>((set) => ({
  rutaActiva: null,
  alertaActiva: false,
  contactos: [],
  historial: [],
  iniciarRuta: (r) => set({ rutaActiva: r }),
  finalizarRuta: () => set({ rutaActiva: null }),
  setAlerta: (v) => set({ alertaActiva: v }),
  setContactos: (c) => set({ contactos: c }),
  setHistorial: (h) => set({ historial: h }),
}))
