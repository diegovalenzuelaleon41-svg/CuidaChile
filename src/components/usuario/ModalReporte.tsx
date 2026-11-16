import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, ChevronLeft, EyeOff, Loader2, MapPin, Mic, Send, Square, Trash2, TriangleAlert, X } from 'lucide-react'
import {
  CATEGORIAS_REPORTE,
  MAX_AUDIO_S,
  MAX_DESCRIPCION,
  comprimirFoto,
  type CategoriaReporte,
  type FormReporte,
} from '../../lib/reportes'
import { useGrabadoraAudio } from '../../hooks/useGrabadoraAudio'

const PLACEHOLDER: Record<CategoriaReporte, string> = {
  vehiculo: 'Ej: auto gris sin patente dando vueltas',
  personas: 'Ej: 3 personas mirando las casas',
  ruidos: 'Ej: gritos y golpes en el pasaje',
  otro: 'Describe brevemente lo que pasa',
}

/** URL local para previsualizar un Blob; se libera al cambiar o desmontar. */
function useUrlObjeto(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const TARJETA = 'rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-md'

interface Props {
  form: FormReporte
  onForm: (patch: Partial<FormReporte>) => void
  coordsTxt: string
  ubicacionElegida: boolean
  guardando: boolean
  onSeleccionarUbicacion: () => void
  onCerrar: () => void
  onGuardar: () => void
}

/**
 * Reportar incidente en 2 pasos. Paso 1: un toque en la categoría, sin
 * teclado. Paso 2: detalle opcional, foto (cámara trasera), nota de voz y
 * anonimato. Siempre oscuro: se usa en la calle, de noche y con prisa.
 */
export default function ModalReporte({
  form,
  onForm,
  coordsTxt,
  ubicacionElegida,
  guardando,
  onSeleccionarUbicacion,
  onCerrar,
  onGuardar,
}: Props) {
  const cat = CATEGORIAS_REPORTE.find((c) => c.id === form.categoria)
  const [procesandoFoto, setProcesandoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const grabadora = useGrabadoraAudio(MAX_AUDIO_S, (audio) => onForm({ audio }))
  const urlFoto = useUrlObjeto(form.foto)
  const urlAudio = useUrlObjeto(form.audio)
  const grabando = grabadora.estado === 'grabando'
  const ocupado = guardando || grabando || procesandoFoto

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return
    setErrorFoto(null)
    setProcesandoFoto(true)
    try {
      onForm({ foto: await comprimirFoto(archivo) })
    } catch {
      // Formato que el navegador no sabe decodificar (p. ej. HEIC en escritorio).
      if (['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) && archivo.size <= 8 * 1024 * 1024) {
        onForm({ foto: archivo })
      } else {
        setErrorFoto('No pudimos leer esa foto. Intenta con otra.')
      }
    } finally {
      setProcesandoFoto(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={ocupado ? undefined : onCerrar}
    >
      <div
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900/90 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl backdrop-blur-xl sm:max-w-[440px] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reporte-titulo"
      >
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />

        <div className="flex items-start gap-1">
          {cat && (
            <button
              type="button"
              onClick={() => onForm({ categoria: '' })}
              disabled={ocupado}
              aria-label="Volver a elegir el tipo de incidente"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 disabled:opacity-40"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="min-w-0 flex-1 pt-1.5">
            <h3 id="reporte-titulo" className="flex items-center gap-2 text-[19px] font-bold leading-tight">
              {cat ? (
                <>
                  <cat.Icono size={20} className="shrink-0 text-amber-300" /> {cat.etiqueta}
                </>
              ) : (
                <>
                  <TriangleAlert size={20} className="shrink-0 text-amber-400" /> ¿Qué está pasando?
                </>
              )}
            </h3>
            <p className="mt-1 text-[12px] text-slate-400">{cat ? 'Paso 2 de 2 · todo es opcional' : 'Paso 1 de 2 · toca una opción'}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {!cat ? (
          /* ── Paso 1: un toque ── */
          <div className="mt-5 grid grid-cols-2 gap-3">
            {CATEGORIAS_REPORTE.map(({ id, etiqueta, Icono }) => (
              <button
                key={id}
                type="button"
                onClick={() => onForm({ categoria: id })}
                className={`${TARJETA} flex min-h-[132px] flex-col items-center justify-center gap-3 px-3 py-4 text-center transition-all hover:border-amber-400/50 hover:bg-white/[0.08] active:scale-[0.97]`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
                  <Icono size={30} strokeWidth={1.9} />
                </span>
                <span className="text-[14px] font-semibold leading-tight text-slate-100">{etiqueta}</span>
              </button>
            ))}
          </div>
        ) : (
          /* ── Paso 2: detalle y evidencia ── */
          <>
            <label className="mb-2 mt-5 block text-[13px] font-semibold text-slate-300" htmlFor="rep-desc">
              ¿Qué viste? <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <textarea
              id="rep-desc"
              value={form.descripcion}
              onChange={(e) => onForm({ descripcion: e.target.value.slice(0, MAX_DESCRIPCION) })}
              placeholder={PLACEHOLDER[cat.id]}
              rows={2}
              disabled={guardando}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[16px] text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
            />

            <p className="mb-2 mt-4 text-[13px] font-semibold text-slate-300">
              Evidencia <span className="font-normal text-slate-500">(opcional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* label + input oculto: capture abre directo la cámara trasera en el celular */}
              <label
                className={`${TARJETA} flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 text-[13px] font-semibold text-slate-100 transition-colors hover:bg-white/[0.09] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-400 ${
                  guardando || procesandoFoto ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={guardando || procesandoFoto}
                  onChange={(e) => {
                    void elegirFoto(e.target.files?.[0])
                    e.target.value = '' // permite sacar otra foto
                  }}
                />
                {procesandoFoto ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} className="text-blue-300" />}
                {form.foto ? 'Cambiar foto' : 'Adjuntar foto'}
              </label>
              <button
                type="button"
                onClick={() => (grabando ? grabadora.detener() : void grabadora.iniciar())}
                disabled={guardando || grabadora.estado === 'pidiendo'}
                aria-pressed={grabando}
                className={`flex h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                  grabando ? 'border-red-500/60 bg-red-500/15 text-red-200' : 'border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]'
                }`}
              >
                {grabando ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
                      <Square size={15} className="fill-current" />
                    </span>
                    <span className="tabular-nums">
                      Detener {mmss(grabadora.segundos)} / {mmss(MAX_AUDIO_S)}
                    </span>
                  </>
                ) : (
                  <>
                    {grabadora.estado === 'pidiendo' ? <Loader2 size={22} className="animate-spin" /> : <Mic size={22} className="text-blue-300" />}
                    {form.audio ? 'Grabar de nuevo' : 'Grabar audio'}
                  </>
                )}
              </button>
            </div>

            {(errorFoto || grabadora.error) && (
              <p role="alert" className="mt-2 text-[12px] text-amber-300">
                {errorFoto ?? grabadora.error}
              </p>
            )}

            {(urlFoto || (urlAudio && !grabando)) && (
              <div className="mt-3 flex items-center gap-3">
                {urlFoto && (
                  <div className="relative shrink-0">
                    <img src={urlFoto} alt="Foto adjunta" className="h-16 w-16 rounded-xl border border-white/10 object-cover" />
                    <button
                      type="button"
                      onClick={() => onForm({ foto: null })}
                      disabled={guardando}
                      aria-label="Quitar foto"
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-slate-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {urlAudio && !grabando && (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <audio src={urlAudio} controls className="h-10 min-w-0 flex-1 [color-scheme:dark]" />
                    <button
                      type="button"
                      onClick={() => onForm({ audio: null })}
                      disabled={guardando}
                      aria-label="Quitar nota de voz"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onSeleccionarUbicacion}
              disabled={ocupado}
              className={`${TARJETA} mt-4 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.09] disabled:opacity-50`}
            >
              {ubicacionElegida ? (
                <CheckCircle2 size={19} className="shrink-0 text-emerald-400" />
              ) : (
                <MapPin size={19} className="shrink-0 text-blue-300" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-100">
                  {ubicacionElegida ? 'Ubicación elegida en el mapa' : 'Tu ubicación actual'}
                </span>
                <span className="block truncate text-[11px] tabular-nums text-slate-400">{coordsTxt}</span>
              </span>
              <span className="text-[12px] font-semibold text-blue-300">Cambiar</span>
            </button>

            <label className={`${TARJETA} mt-3 flex cursor-pointer items-center gap-3 px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-400`}>
              <EyeOff size={19} className="shrink-0 text-slate-300" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-100">Enviar como anónimo</span>
                <span className="block text-[11px] leading-snug text-slate-400">
                  La central no verá tu nombre. Los vecinos nunca ven quién reporta.
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.esAnonimo}
                onChange={(e) => onForm({ esAnonimo: e.target.checked })}
                disabled={guardando}
                className="h-6 w-6 shrink-0 accent-blue-500"
              />
            </label>

            <button
              type="button"
              onClick={onGuardar}
              disabled={ocupado}
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[17px] font-bold text-white shadow-[0_0_24px_rgba(37,99,235,0.45)] transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50"
            >
              {guardando ? <Loader2 size={20} className="animate-spin" /> : <Send size={19} />}
              {guardando ? 'Enviando…' : 'Enviar Reporte'}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">La central lo revisa antes de avisar a tus vecinos.</p>
          </>
        )}
      </div>
    </div>
  )
}
