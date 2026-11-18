import { useEffect, useRef, useState } from 'react'
import { Siren } from 'lucide-react'

/** Segundos para cancelar un SOS que no salió del botón (atajo, link o agitar). */
const SEGUNDOS = 5

/**
 * Cuenta regresiva antes de un SOS disparado sin el botón: da tiempo a cancelar si fue sin querer
 * (o si alguien abrió el link por error). Al llegar a cero llama a onEnviar.
 */
export default function CuentaRegresivaSOS({
  origen,
  discreto,
  onEnviar,
  onCancelar,
}: {
  origen: 'atajo' | 'agitar'
  discreto: boolean
  onEnviar: () => void
  onCancelar: () => void
}) {
  const [segundos, setSegundos] = useState(SEGUNDOS)
  const onEnviarRef = useRef(onEnviar)
  useEffect(() => {
    onEnviarRef.current = onEnviar
  })

  useEffect(() => {
    if (!discreto) {
      try {
        navigator.vibrate?.(200)
      } catch {
        /* sin vibración */
      }
    }
  }, [discreto])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (segundos > 1) setSegundos(segundos - 1)
      else onEnviarRef.current()
    }, 1000)
    return () => window.clearTimeout(t)
  }, [segundos])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cuenta-sos-titulo"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            discreto ? 'bg-white/10 text-slate-300' : 'bg-red-500/15 text-red-400'
          }`}
          aria-hidden
        >
          <Siren size={28} />
        </span>
        <h2 id="cuenta-sos-titulo" className="mt-4 text-2xl font-bold">
          Enviando SOS
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-slate-300">
          {origen === 'agitar' ? 'Agitaste el teléfono.' : 'Abriste el acceso rápido al SOS.'} La alerta sale sola
          cuando termine la cuenta.
        </p>
        <p
          className={`mt-4 text-center text-5xl font-black tabular-nums ${discreto ? 'text-slate-200' : 'text-red-400'}`}
          aria-live="polite"
        >
          {segundos}
        </p>
        <button
          type="button"
          onClick={() => onEnviarRef.current()}
          className={`mt-6 h-14 w-full rounded-2xl text-[17px] font-bold transition-colors ${
            discreto ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          Enviar ahora
        </button>
        <button
          type="button"
          onClick={onCancelar}
          autoFocus
          className="mt-3 h-12 w-full rounded-2xl border-2 border-white/15 text-[15px] font-bold text-slate-200 transition-colors hover:bg-white/5"
        >
          Cancelar, fue sin querer
        </button>
      </div>
    </div>
  )
}
