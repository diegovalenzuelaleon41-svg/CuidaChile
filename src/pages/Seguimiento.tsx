import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { MapPinOff, Phone, ShieldCheck } from 'lucide-react'
import { verSeguimiento, type VistaSeguimiento } from '../lib/seguimiento'

maplibregl.config.WORKER_URL = mapWorkerUrl

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const REFRESCO_MS = 5000

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

  const abierta = !!vista && vista.estado !== 'terminado' && vista.estado !== 'no_encontrado'
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
  } else if (vista?.estado === 'terminado') {
    titulo = esSOS ? 'La alerta terminó' : vista.tipo === 'ruta' ? 'El trayecto terminó' : 'Este seguimiento terminó'
    detalle = 'Por privacidad ya no mostramos su ubicación.'
  } else if (vista) {
    titulo = esSOS ? `${nombre} activó una alerta SOS` : `${nombre} va camino a ${vista.destino ?? 'su destino'}`
    detalle = esSOS
      ? vista.atendida
        ? 'Un operador de CuidaChile está atendiendo la alerta.'
        : 'La central de CuidaChile recibió la alerta y está asignando un operador.'
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
            abierta && esSOS ? 'border-red-500/40 bg-red-500/[0.08]' : 'border-slate-800 bg-slate-900/70'
          }`}
          aria-live="polite"
        >
          <h1 className="text-xl font-bold leading-tight">{titulo}</h1>
          {detalle && <p className="mt-1.5 text-[15px] leading-snug text-slate-300">{detalle}</p>}
          {actualizado && <p className="mt-2 text-xs text-slate-500">Ubicación actualizada {actualizado}</p>}
        </section>

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
