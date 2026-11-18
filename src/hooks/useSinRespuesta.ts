import { useEffect, useRef, useState } from 'react'

/** Tiempo sin que un operador tome el SOS antes de decirlo y sugerir el 133 y los contactos. */
export const SIN_RESPUESTA_MS = 45_000

/**
 * true cuando el SOS lleva SIN_RESPUESTA_MS abierto sin que un operador lo tome. Cuenta desde
 * creada_en (sirve tras recargar), pero nunca espera más de SIN_RESPUESTA_MS desde que se ve en
 * este teléfono: si el reloj del teléfono va atrasado, el aviso no se retrasa.
 * onVencer se llama una vez por alerta, aunque la pantalla SOS esté oculta.
 */
export function useSinRespuesta(alertaId: string | null, esperando: boolean, creadaEn: string | null, onVencer: () => void) {
  const [vencida, setVencida] = useState<string | null>(null)
  const onVencerRef = useRef(onVencer)
  useEffect(() => {
    onVencerRef.current = onVencer
  })

  const avisadaRef = useRef<string | null>(null)

  useEffect(() => {
    if (!alertaId || !esperando) return
    // Ya se avisó (el efecto se rearmó): `vencida` sigue marcada, no se avisa de nuevo.
    if (avisadaRef.current === alertaId) return
    const desdeServidor = creadaEn ? Date.parse(creadaEn) + SIN_RESPUESTA_MS - Date.now() : SIN_RESPUESTA_MS
    const espera = Math.max(0, Math.min(SIN_RESPUESTA_MS, Number.isNaN(desdeServidor) ? SIN_RESPUESTA_MS : desdeServidor))
    const t = window.setTimeout(() => {
      avisadaRef.current = alertaId
      setVencida(alertaId)
      onVencerRef.current()
    }, espera)
    return () => window.clearTimeout(t)
  }, [alertaId, esperando, creadaEn])

  return esperando && !!alertaId && vencida === alertaId
}
