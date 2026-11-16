import { useEffect, useRef, useState } from 'react'
import { ImageOff, Loader2, Pause, Play } from 'lucide-react'
import { urlFirmada } from '../../lib/reportes'

/** URL firmada (1 h) de un archivo del bucket privado de evidencias. */
function useUrlFirmada(ruta: string | null | undefined) {
  const [res, setRes] = useState<{ ruta: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!ruta) return
    let vivo = true
    void urlFirmada(ruta).then((url) => {
      if (vivo) setRes({ ruta, url })
    })
    return () => {
      vivo = false
    }
  }, [ruta])
  const vigente = res && res.ruta === ruta ? res : null
  return { url: vigente?.url ?? null, cargando: !!ruta && !vigente, fallo: !!vigente && !vigente.url }
}

/** Miniatura de la foto; clic abre la imagen completa en otra pestaña. */
export function MiniaturaFoto({ ruta, tam = 'chica' }: { ruta: string; tam?: 'chica' | 'grande' }) {
  const { url, cargando, fallo } = useUrlFirmada(ruta)
  const clases = tam === 'grande' ? 'h-24 w-24' : 'h-11 w-11'
  if (cargando || fallo || !url) {
    return (
      <span className={`${clases} flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-500`}>
        {cargando ? <Loader2 size={14} className="animate-spin" /> : <ImageOff size={14} />}
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      title="Ver foto completa"
      className={`${clases} block shrink-0 overflow-hidden rounded-lg border border-slate-600 hover:border-amber-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60`}
    >
      <img src={url} alt="Foto del reporte" className="h-full w-full object-cover" loading="lazy" />
    </a>
  )
}

/** Botón Play/Pausa de la nota de voz (sin controles nativos: cabe en la tarjeta). */
export function BotonAudio({ ruta, conTexto = false }: { ruta: string; conTexto?: boolean }) {
  const { url, cargando, fallo } = useUrlFirmada(ruta)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [sonando, setSonando] = useState(false)

  useEffect(() => () => audioRef.current?.pause(), [])

  function alternar() {
    if (!url) return
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setSonando(false)
      audioRef.current.onpause = () => setSonando(false)
      audioRef.current.onplay = () => setSonando(true)
    }
    if (sonando) audioRef.current.pause()
    else void audioRef.current.play().catch(() => setSonando(false))
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        alternar()
      }}
      onKeyDown={(e) => e.stopPropagation()}
      disabled={!url}
      aria-label={sonando ? 'Pausar nota de voz' : 'Escuchar nota de voz'}
      title={fallo ? 'No se pudo cargar el audio' : 'Nota de voz'}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${
        conTexto ? 'h-9 px-3' : 'h-11 w-11'
      } ${
        sonando
          ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
          : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-amber-400/60 hover:text-white'
      }`}
    >
      {cargando ? <Loader2 size={15} className="animate-spin" /> : sonando ? <Pause size={15} /> : <Play size={15} />}
      {conTexto && (sonando ? 'Pausar' : 'Escuchar audio')}
    </button>
  )
}
