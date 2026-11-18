import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { CheckCircle2, Heart, Loader2, MapPinOff, Phone, ShieldCheck } from 'lucide-react'
import {
  acompanar,
  guardarNombreAcompanante,
  idVisitante,
  leerNombreAcompanante,
  verSeguimiento,
  type VistaSeguimiento,
} from '../lib/seguimiento'

maplibregl.config.WORKER_URL = mapWorkerUrl

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const REFRESCO_MS = 5000
/** Latido del acompañante: la persona ve "te acompaña" mientras esta página siga abierta. */
const LATIDO_MS = 30_000
/** Entre dos "Aquí estoy" (la base de datos tampoco cuenta más seguido). */
const PAUSA_TOQUE_MS = 10_000

function haceCuanto(iso?: string) {
  if (!iso) return null
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  return m < 60 ? `hace ${m} min` : null
}

/**
 * /seguir/:token — lo que ve un contacto con el link: dónde está la persona mientras su SOS o su
 * ruta acompañada sigue abierta. Sin cuenta. Se refresca cada 5 s; al terminar, solo dice que terminó.
 */
export default function Seguimiento() {
  const { token = '' } = useParams()
  const [vista, setVista] = useState<VistaSeguimiento | null>(null)
  const [sinRed, setSinRed] = useState(false)
  const contenedor = useRef<HTMLDivElement | null>(null)
  const mapa = useRef<maplibregl.Map | null>(null)
  const marcador = useRef<maplibregl.Marker | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelado = false
    async function pedir() {
      const v = /^[0-9a-f-]{36}$/i.test(token) ? await verSeguimiento(token) : { estado: 'no_encontrado' as const }
      if (cancelado) return
      if (v) {
        setVista(v)
        setSinRed(false)
      } else setSinRed(true)
    }
    void pedir()
    const t = window.setInterval(() => {
      void pedir()
      setTick((n) => n + 1)
    }, REFRESCO_MS)
    return () => {
      cancelado = true
      window.clearInterval(t)
    }
  }, [token])

  const abierta = !!vista && vista.estado !== 'terminado' && vista.estado !== 'no_encontrado' && vista.estado !== 'llego'
  const lng = abierta ? vista?.lng ?? null : null
  const lat = abierta ? vista?.lat ?? null : null
  const destinoLng = vista?.destino_lng ?? null
  const destinoLat = vista?.destino_lat ?? null
  const hayPosicion = lng != null && lat != null

  // Mapa: se crea con la primera posición y luego solo se mueve el marcador.
  useEffect(() => {
    if (lng == null || lat == null || !contenedor.current) return
    if (!mapa.current) {
      mapa.current = new maplibregl.Map({
        container: contenedor.current,
        style: MAP_STYLE,
        center: [lng, lat],
        zoom: 15,
        attributionControl: { compact: true },
      })
      const pin = document.createElement('div')
      pin.className = 'h-5 w-5 rounded-full border-[3px] border-white bg-red-500 shadow-[0_0_0_8px_rgba(239,68,68,0.25)]'
      marcador.current = new maplibregl.Marker({ element: pin }).setLngLat([lng, lat]).addTo(mapa.current)
      if (destinoLng != null && destinoLat != null) {
        const destino = document.createElement('div')
        destino.className = 'h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500'
        new maplibregl.Marker({ element: destino }).setLngLat([destinoLng, destinoLat]).addTo(mapa.current)
      }
      return
    }
    marcador.current?.setLngLat([lng, lat])
    mapa.current.easeTo({ center: [lng, lat], duration: 800 })
  }, [lng, lat, destinoLng, destinoLat])

  useEffect(() => () => mapa.current?.remove(), [])

  const nombre = vista?.nombre ? vista.nombre.charAt(0).toUpperCase() + vista.nombre.slice(1) : 'Esta persona'
  const esSOS = vista?.tipo === 'sos'

  let titulo = 'Cargando…'
  let detalle: string | null = null
  if (vista?.estado === 'no_encontrado') {
    titulo = 'Este link no existe'
    detalle = 'Revisa que lo hayas copiado completo.'
  } else if (vista?.estado === 'llego') {
    titulo = `${nombre} marcó que llegó bien`
    detalle = `${vista.destino ? `A ${vista.destino}, a` : 'A'} las ${horaDe(vista.llego_en)}. Por privacidad ya no mostramos su ubicación.`
  } else if (vista?.estado === 'terminado') {
    titulo = esSOS ? 'La alerta terminó' : vista.tipo === 'ruta' ? 'El trayecto terminó' : 'Este seguimiento terminó'
    detalle = 'Por privacidad ya no mostramos su ubicación.'
  } else if (vista) {
    titulo = esSOS ? `${nombre} activó una alerta SOS` : `${nombre} va camino a ${vista.destino ?? 'su destino'}`
    detalle = esSOS
      ? vista.atendida
        ? 'Un operador de CuidaChile está atendiendo la alerta.'
        : 'La alerta quedó registrada en la central de CuidaChile. Aún ningún operador la ha tomado.'
      : vista.atendida
        ? 'Un operador de CuidaChile la acompaña en este trayecto.'
        : 'Esperando que un operador de CuidaChile tome el trayecto.'
  }
  const actualizado = abierta ? haceCuanto(vista?.actualizado_en) : null

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#050B14] text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-bold">
          <ShieldCheck size={20} className="text-cyan-400" /> CuidaChile
        </Link>
        {sinRed && <span className="text-xs text-amber-300">Sin conexión, reintentando…</span>}
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-6">
        <section
          className={`rounded-3xl border p-5 ${
            abierta && esSOS
              ? 'border-red-500/40 bg-red-500/[0.08]'
              : vista?.estado === 'llego'
                ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
                : 'border-slate-800 bg-slate-900/70'
          }`}
          aria-live="polite"
        >
          <h1 className="flex items-start gap-2 text-xl font-bold leading-tight">
            {vista?.estado === 'llego' && <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden />}
            {titulo}
          </h1>
          {detalle && <p className="mt-1.5 text-[15px] leading-snug text-slate-300">{detalle}</p>}
          {actualizado && <p className="mt-2 text-xs text-slate-500">Ubicación actualizada {actualizado}</p>}
        </section>

        {abierta && <Acompanar token={token} nombre={nombre} />}

        {abierta && !hayPosicion && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <MapPinOff size={18} /> Todavía no llega su ubicación GPS.
          </p>
        )}

        <div
          ref={contenedor}
          className={`mt-4 min-h-[320px] flex-1 overflow-hidden rounded-3xl border border-slate-800 ${hayPosicion ? '' : 'hidden'}`}
          aria-label="Mapa con su ubicación"
        />

        {abierta && esSOS && (
          <a
            href="tel:133"
            className="mt-4 flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-red-600 text-[17px] font-bold transition-colors hover:bg-red-500"
          >
            <Phone size={20} /> Llamar al 133 (Carabineros)
          </a>
        )}
      </main>
    </div>
  )
}

function horaDe(iso?: string) {
  return iso ? new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '—'
}

/**
 * "Acompañar": el contacto deja su nombre y la persona ve que la acompaña mientras esta página siga
 * abierta. "Aquí estoy" le llega como aviso. Sin cuenta: un identificador anónimo del navegador.
 */
function Acompanar({ token, nombre }: { token: string; nombre: string }) {
  const [miNombre, setMiNombre] = useState(leerNombreAcompanante)
  const [unido, setUnido] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enPausa, setEnPausa] = useState(false)

  // Latido mientras la página esté abierta y visible.
  useEffect(() => {
    if (!unido) return
    const visitante = idVisitante()
    const nombreGuardado = leerNombreAcompanante()
    const latir = () => {
      if (document.visibilityState === 'visible') void acompanar(token, visitante, nombreGuardado)
    }
    const t = window.setInterval(latir, LATIDO_MS)
    document.addEventListener('visibilitychange', latir)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', latir)
    }
  }, [unido, token])

  async function aquiEstoy() {
    const limpio = miNombre.trim().replace(/\s+/g, ' ').slice(0, 30)
    if (!limpio || enviando || enPausa) return
    setEnviando(true)
    setAviso(null)
    guardarNombreAcompanante(limpio)
    const ok = await acompanar(token, idVisitante(), limpio, true)
    setEnviando(false)
    if (ok === null) {
      setAviso('Sin conexión. Intenta de nuevo.')
      return
    }
    if (!ok) {
      setAviso('No pudimos unirte: el seguimiento terminó o ya tiene 10 personas.')
      return
    }
    setUnido(true)
    setAviso(`${nombre} recibió tu "Aquí estoy".`)
    setEnPausa(true)
    window.setTimeout(() => setEnPausa(false), PAUSA_TOQUE_MS)
  }

  return (
    <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5" aria-label="Acompañar">
      {unido ? (
        <>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Heart size={18} className="text-cyan-400" aria-hidden /> Estás acompañando a {nombre}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-slate-400">
            Ve tu nombre mientras tengas esta página abierta.
          </p>
        </>
      ) : (
        <>
          <p className="text-[15px] font-semibold">¿Acompañas a {nombre}?</p>
          <p className="mt-1 text-[13px] leading-snug text-slate-400">
            Verá tu nombre mientras tengas esta página abierta. Solo eso: no ve tu ubicación.
          </p>
          <label htmlFor="acompanante-nombre" className="sr-only">
            Tu nombre
          </label>
          <input
            id="acompanante-nombre"
            value={miNombre}
            onChange={(e) => setMiNombre(e.target.value)}
            maxLength={30}
            placeholder="Tu nombre"
            autoComplete="given-name"
            className="mt-3 h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-[15px] text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </>
      )}
      <button
        type="button"
        onClick={() => void aquiEstoy()}
        disabled={!miNombre.trim() || enviando || enPausa}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 text-[15px] font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
      >
        {enviando ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} />}
        {unido ? 'Enviar "Aquí estoy"' : `Acompañar a ${nombre}`}
      </button>
      {aviso && (
        <p className="mt-2 text-center text-[13px] text-slate-300" aria-live="polite">
          {aviso}
        </p>
      )}
    </section>
  )
}
