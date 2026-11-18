import { useEffect, useRef, useState } from 'react'
import { Loader2, LocateFixed, MapPin, X } from 'lucide-react'
import { buscarDirecciones, direccionDesdeCoords, type ResultadoGeo } from '../../lib/geocoding'
import { NOMBRE_LUGAR, type Lugar, type TipoLugar } from '../../lib/lugares'

/**
 * Guardar o cambiar Casa o Trabajo: buscar la dirección o usar la ubicación actual.
 * onGuardar devuelve un mensaje de error o null.
 */
export default function ModalLugar({
  tipo,
  actual,
  obtenerGps,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  tipo: TipoLugar
  actual: Lugar | null
  /** GPS real [lng, lat], o null si aún no hay. */
  obtenerGps: () => [number, number] | null
  onGuardar: (lugar: Lugar) => Promise<string | null>
  onBorrar: (() => void) | null
  onCerrar: () => void
}) {
  const nombre = NOMBRE_LUGAR[tipo]
  const [texto, setTexto] = useState('')
  const [sugs, setSugs] = useState<ResultadoGeo[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounce = useRef<number | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      if (debounce.current) window.clearTimeout(debounce.current)
      abort.current?.abort()
    },
    [],
  )

  function onTexto(v: string) {
    setTexto(v)
    setError(null)
    if (debounce.current) window.clearTimeout(debounce.current)
    abort.current?.abort()
    if (v.trim().length < 3) {
      setSugs([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    debounce.current = window.setTimeout(async () => {
      const ctl = new AbortController()
      abort.current = ctl
      try {
        setSugs(await buscarDirecciones(v, ctl.signal))
      } catch {
        if (!ctl.signal.aborted) setSugs([])
      } finally {
        if (!ctl.signal.aborted) setBuscando(false)
      }
    }, 400)
  }

  async function guardar(direccion: string, lat: number, lng: number) {
    setGuardando(true)
    const err = await onGuardar({ tipo, direccion, lat, lng })
    setGuardando(false)
    if (err) setError(err)
  }

  async function usarUbicacion() {
    const gps = obtenerGps()
    if (!gps) {
      setError('Aún no tenemos tu ubicación GPS. Busca la dirección.')
      return
    }
    setGuardando(true)
    const dir = await direccionDesdeCoords(gps[1], gps[0]).catch(() => null)
    setGuardando(false)
    await guardar(dir ?? 'Mi ubicación guardada', gps[1], gps[0])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lugar-titulo"
        className="card relative w-full max-w-[440px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-faint hover:bg-canvas dark:hover:bg-slate-800"
        >
          <X size={20} />
        </button>
        <h3 id="lugar-titulo" className="pr-10 text-[18px] font-bold text-heading dark:text-white">
          {actual ? `Cambiar ${nombre}` : `Guardar ${nombre}`}
        </h3>
        <p className="mt-1 text-[13px] text-muted dark:text-slate-400">
          Así inicias la ruta con un toque. Solo tú ves tus lugares.
        </p>
        {actual && <p className="mt-3 text-[13px] text-ink dark:text-slate-200">Ahora: {actual.direccion}</p>}

        <label className="label-cuida mt-4 mb-2" htmlFor="lugar-direccion">
          Dirección
        </label>
        <div className="relative">
          <input
            id="lugar-direccion"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            className="input-cuida"
            placeholder="Calle y número, comuna"
            autoComplete="street-address"
          />
          {buscando && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-faint" aria-hidden />
          )}
        </div>
        {sugs.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line dark:border-slate-700">
            {sugs.map((s) => (
              <li key={`${s.lat},${s.lng}`}>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void guardar(s.etiqueta, s.lat, s.lng)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] text-ink hover:bg-canvas disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <MapPin size={15} className="mt-0.5 shrink-0 text-brand-600" />
                  {s.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => void usarUbicacion()}
          disabled={guardando}
          className="btn-secondary mt-4 flex w-full items-center justify-center gap-2 py-3 text-[14px] disabled:opacity-50"
        >
          {guardando ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
          Usar mi ubicación actual
        </button>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-sos">
            {error}
          </p>
        )}
        {onBorrar && (
          <button
            type="button"
            onClick={onBorrar}
            disabled={guardando}
            className="mt-3 h-10 w-full text-[13px] font-medium text-muted hover:text-sos dark:text-slate-400"
          >
            Quitar {nombre}
          </button>
        )}
      </div>
    </div>
  )
}
