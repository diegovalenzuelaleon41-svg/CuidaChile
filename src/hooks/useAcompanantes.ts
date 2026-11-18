import { useEffect, useRef, useState } from 'react'
import { misAcompanantes, type Acompanante, type ObjetivoSeguimiento } from '../lib/seguimiento'

const REFRESCO_MS = 10_000

/**
 * Quién acompaña desde el link de seguimiento el SOS o la ruta abierta. Se consulta cada 10 s
 * mientras haya objetivo. Cada "Aquí estoy" nuevo llama a onToque con el nombre (los anteriores a
 * la primera consulta no: no se repiten avisos viejos al recargar).
 */
export function useAcompanantes(objetivo: ObjetivoSeguimiento | null, onToque: (nombre: string) => void) {
  const [lista, setLista] = useState<{ clave: string; acompanantes: Acompanante[] } | null>(null)
  const onToqueRef = useRef(onToque)
  useEffect(() => {
    onToqueRef.current = onToque
  })

  const esAlerta = !!objetivo && 'alertaId' in objetivo
  const clave = objetivo ? ('alertaId' in objetivo ? objetivo.alertaId : objetivo.acompanamientoId) : null

  useEffect(() => {
    if (!clave) return
    let cancelado = false
    // visitante → último toque ya avisado; null hasta la primera consulta.
    let vistos: Map<string, string | null> | null = null

    async function pedir() {
      if (!clave) return
      const r = await misAcompanantes(esAlerta ? { alertaId: clave } : { acompanamientoId: clave })
      if (cancelado || !r) return
      if (vistos) {
        for (const a of r) {
          if (a.ultimo_toque_en && a.ultimo_toque_en !== vistos.get(a.visitante)) onToqueRef.current(a.nombre)
        }
      }
      vistos = new Map(r.map((a) => [a.visitante, a.ultimo_toque_en]))
      setLista({ clave, acompanantes: r })
    }

    void pedir()
    const t = window.setInterval(() => void pedir(), REFRESCO_MS)
    return () => {
      cancelado = true
      window.clearInterval(t)
    }
  }, [clave, esAlerta])

  // De otro SOS o ruta, o sin objetivo: nada.
  return lista && lista.clave === clave ? lista.acompanantes : []
}
