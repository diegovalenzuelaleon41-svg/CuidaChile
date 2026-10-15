import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// Vite empaqueta el worker como asset aparte: hay que indicarle la URL.
// Sin esto el mapa falla con "Worker failed to load" y nunca dispara 'load'.
maplibregl.config.WORKER_URL = mapWorkerUrl
import {
  CheckCircle2, Clock3, Crosshair, Hand, LocateFixed, MapPin, MessageCircle,
  Minus, Navigation, Play, Plus, Search, TriangleAlert, Users, X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { buscarDirecciones, direccionDesdeCoords, type ResultadoGeo } from '../lib/geocoding'
import { obtenerRutaCalles } from '../lib/rutaOSRM'
import Supercluster from 'supercluster'
import {
  FOTO_OPERADOR, MENSAJE_BIENVENIDA_OPERADOR, MENSAJE_FIN_RUTA_OPERADOR,
  OPERADOR_NOMBRE, detectarPeligro,
} from '../lib/operador'
// Burbuja amable cuando la IA no responde (alta demanda, sin conexión, timeout).
const MENSAJE_FALLO_IA = '⚠️ Hubo un problema de conexión. Por favor, intenta de nuevo.'
// Mensaje de cuota: lo devuelve la Edge Function (429) y se muestra tal cual
// en la burbuja (ver extraerMensajeCuota). Fuente única: el servidor.
// Freno local: 1 mensaje cada 5 s para no saturar el RPM del nivel gratuito.
const UMBRAL_ENVIO_MS = 5000
import { useSeguridad, type Contacto } from '../store/usoSeguridad'
import DashboardHeader from '../components/usuario/DashboardHeader'
import MapaSeguro, { type GpsEstado, type MapEstado } from '../components/usuario/MapaSeguro'
import BottomNav, { type TabId } from '../components/usuario/BottomNav'
import StatsRuta from '../components/usuario/StatsRuta'
import CirculoLista from '../components/usuario/CirculoLista'
import HistorialLista from '../components/usuario/HistorialLista'
import ChatOperador from '../components/usuario/ChatOperador'
import { ModalRuta, ModalContacto, ModalSOS, ModalReporte, type FormContacto, type FormReporte } from '../components/usuario/Modales'

// Reporte comunitario: pin visible 6 h; a las 2 h se atenúa a amarillo.
interface Reporte {
  id: string
  usuario_id: string
  lat: number
  lng: number
  categoria: 'robo' | 'sospechoso' | 'accidente'
  gravedad: 'rojo' | 'amarillo' | 'azul'
  descripcion: string | null
  creado_en: string
}

const COLOR_GRAVEDAD: Record<Reporte['gravedad'], string> = {
  rojo: '#DC2626',
  amarillo: '#F59E0B',
  azul: '#2563EB',
}

const ETIQUETA_CATEGORIA: Record<Reporte['categoria'], string> = {
  robo: 'Robo',
  sospechoso: 'Sospechoso',
  accidente: 'Accidente',
}

// Orden de superposición: rojo encima de amarillo, amarillo encima de azul.
const RANK_GRAVEDAD: Record<Reporte['gravedad'], number> = {
  rojo: 3,
  amarillo: 2,
  azul: 1,
}

/** Opacidad por antigüedad (time decay): 0 h → 0.8, 5 h → 0.1, piso 0.1. */
function opacidadReporte(creadoEn: string, ahora = Date.now()): number {
  const edadH = Math.max(0, (ahora - new Date(creadoEn).getTime()) / 3_600_000)
  return Math.max(0.1, 0.8 - edadH * 0.14)
}

/** Color efectivo del pin (null = no mostrar): >6 h se oculta, >2 h pasa a amarillo. */
function colorReporte(r: Reporte, ahora = Date.now()): string | null {
  const edadH = (ahora - new Date(r.creado_en).getTime()) / 3_600_000
  if (!(edadH >= 0) || edadH >= 6) return null
  if (edadH >= 2) return COLOR_GRAVEDAD.amarillo
  return COLOR_GRAVEDAD[r.gravedad] ?? COLOR_GRAVEDAD.amarillo
}

function edadCorta(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.round(min / 60)} h`
}

/** Polígono circular (radio en metros) para sombrear la zona del reporte. */
function circuloZona(lng: number, lat: number, radioM = 150, puntos = 28): [number, number][] {
  const anillo: [number, number][] = []
  const dLat = radioM / 111_320
  const dLng = radioM / (111_320 * Math.max(0.3, Math.cos((lat * Math.PI) / 180)))
  for (let i = 0; i <= puntos; i++) {
    const a = (i / puntos) * Math.PI * 2
    anillo.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat])
  }
  return anillo
}

const SANTIAGO: [number, number] = [-70.6693, -33.4489]
// Estilo limpio y luminoso tipo landing (CARTO Positron).
// Se evaluó OpenFreeMap Liberty (`https://tiles.openfreemap.org/styles/liberty`),
// más colorido pero con más ruido visual: Positron combina mejor con el azul
// #2563EB de CuidaChile (máximo contraste ruta/fondo). Para comparar basta
// cambiar esta constante.
const MAP_STYLE_CLARO = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const MAP_STYLE_OSCURO = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_STYLE_FALLBACK = 'https://tiles.openfreemap.org/styles/liberty'
// Máximo a esperar por la IA (Edge Function + Gemini) antes de responder
// con las reglas locales. 60 s: la función reintenta hasta 3 veces por modelo
// (backoff 1 s + 2 s) y puede probar el modelo de respaldo, así que con 20 s
// el timeout ganaba la carrera y se mostraban las reglas aunque Gemini
// respondiera bien después. Configurable para la demo.
const TIEMPO_MAX_IA_MS = 60000

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function fmtDur(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function Usuario() {
  // La ruta está envuelta en <Protected>: aquí siempre hay sesión.
  const { user, signOut } = useAuth()
  const { esOscuro } = useTheme()
  // Tema aplicado al estilo del mapa (evita setStyle redundantes).
  const temaMapaRef = useRef<boolean | null>(null)
  // Generación del estilo: cambia en cada 'load' (incluido setStyle por tema)
  // y fuerza el redibujado de las capas propias (ruta, previa, zonas).
  const [estiloKey, setEstiloKey] = useState(0)

  // Cambio claro↔oscuro con mapa vivo: conserva cámara/zoom; el 'load'
  // posterior redibuja las capas propias vía estiloKey.
  useEffect(() => {
    if (temaMapaRef.current === esOscuro) return
    temaMapaRef.current = esOscuro
    const map = mapObj.current
    if (!map) return
    try {
      map.setStyle(esOscuro ? MAP_STYLE_OSCURO : MAP_STYLE_CLARO)
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esOscuro])
  const {
    rutaActiva, alertaActiva, contactos, historial, mensajes,
    sesionFinalizada,
    iniciarRuta, finalizarRuta, setAlerta, setContactos, setHistorial, pushMensaje,
    revisarExpiracion,
  } = useSeguridad()

  // Al abrir: si la última sesión expiró (>12 h sin actividad), se marca finalizada.
  useEffect(() => {
    revisarExpiracion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [nombre, setNombre] = useState<string>(user?.email ?? 'Usuario')
  const [tab, setTab] = useState<TabId>('inicio')
  const [pos, setPos] = useState<[number, number]>(SANTIAGO)
  const [mapEstado, setMapEstado] = useState<MapEstado>('cargando')
  const [gpsEstado, setGpsEstado] = useState<GpsEstado>('pendiente')
  const [gpsDetalle, setGpsDetalle] = useState<string | null>(null)
  const [permisoGps, setPermisoGps] = useState<'granted' | 'denied' | 'prompt' | 'desconocido'>('desconocido')
  const [mapIntento, setMapIntento] = useState(0)
  const [mapDetalle, setMapDetalle] = useState<string | null>(null)
  const [showRuta, setShowRuta] = useState(false)
  const [destino, setDestino] = useState('')
  const [destSel, setDestSel] = useState<ResultadoGeo | null>(null)
  const [sugs, setSugs] = useState<ResultadoGeo[]>([])
  const [buscando, setBuscando] = useState(false)
  // Origen editable: por defecto GPS, pero se puede escribir la dirección exacta
  const [origen, setOrigen] = useState('')
  const [origenSel, setOrigenSel] = useState<ResultadoGeo | null>(null)
  const [sugsOrigen, setSugsOrigen] = useState<ResultadoGeo[]>([])
  const [buscandoOrigen, setBuscandoOrigen] = useState(false)
  const [dirActual, setDirActual] = useState<string | null>(null)
  const [acc, setAcc] = useState<number | null>(null)
  const [lineaRuta, setLineaRuta] = useState<[number, number][] | null>(null)
  const [infoRuta, setInfoRuta] = useState<{ distanciaM: number; duracionS: number } | null>(null)
  const [showContacto, setShowContacto] = useState(false)
  const [formC, setFormC] = useState<FormContacto>({ nombre: '', telefono: '', relacion: 'familia' })
  // Reportes comunitarios
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [showReporte, setShowReporte] = useState(false)
  const [formRep, setFormRep] = useState<FormReporte>({ categoria: '', gravedad: '', descripcion: '' })
  const [repGuardando, setRepGuardando] = useState(false)
  // Ubicación del reporte: GPS por defecto o elegida en el mapa (pin central)
  const [reportLoc, setReportLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [selReporte, setSelReporte] = useState(false)
  const [centroRep, setCentroRep] = useState<{ lat: number; lng: number } | null>(null)
  // Popup único: solo un reporte activo a la vez
  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const markerElsRef = useRef(new Map<string, HTMLElement>())
  const [showChat, setShowChat] = useState(false)
  const [operadorEscribiendo, setOperadorEscribiendo] = useState(false)
  const [showSosModal, setShowSosModal] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  // Destino elegido con pin central (prevista antes de confirmar)
  const [preview, setPreview] = useState<{ lat: number; lng: number; etiqueta: string } | null>(null)
  const [previewInfo, setPreviewInfo] = useState<{ distanciaM: number; duracionS: number } | null>(null)
  const [previewLinea, setPreviewLinea] = useState<[number, number][] | null>(null)
  const [previewCargando, setPreviewCargando] = useState(false)
  // ── Modo "pin central": arrastrar para seleccionar destino ──
  const [seleccionandoDestino, setSeleccionandoDestino] = useState(false)
  const [centroMapa, setCentroMapa] = useState<{ lat: number; lng: number } | null>(null)
  const [centroMovido, setCentroMovido] = useState(false)

  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapObj = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null)
  const debounceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceOrigenRef = useRef<number | null>(null)
  const abortOrigenRef = useRef<AbortController | null>(null)
  // Throttle del chat: marca del último envío aceptado (1 cada 5 s).
  const ultimoEnvioRef = useRef<number>(0)
  // Para volar la cámara a tu posición real solo con el primer fix GPS.
  const fijadoInicial = useRef(false)
  // Flag fresco del modo pin-central (el mapa vive fuera de React)
  const seleccionandoRef = useRef(false)
  seleccionandoRef.current = seleccionandoDestino
  // Flag del modo "ubicar reporte" (pin central para el reporte, no destino)
  const selReporteRef = useRef(false)
  selReporteRef.current = selReporte
  // Estado fresco para handlers del mapa (se crea una sola vez)
  const estadoRef = useRef({ pos, tab, hayRuta: !!rutaActiva })
  estadoRef.current = { pos, tab, hayRuta: !!rutaActiva }

  const protegido = !alertaActiva

  // Perfil
  useEffect(() => {
    if (!user) return
    let vivo = true
    ;(async () => {
      try {
        const { data } = await supabase.from('perfil').select('nombre').eq('id', user.id).maybeSingle()
        if (vivo && data?.nombre) setNombre(data.nombre)
      } catch { /* noop */ }
    })()
    return () => { vivo = false }
  }, [user])

  // Monitor del permiso de ubicación: dice QUÉ ve el navegador
  // (granted/denied/prompt) y reintenta solo cuando cambia a granted.
  // Si es 'denied', el navegador jamás mostrará el diálogo: hay que
  // desbloquearlo en el candado de la barra de direcciones.
  useEffect(() => {
    let vivo = true
    let estado: PermissionStatus | null = null
    ;(async () => {
      try {
        if (!('permissions' in navigator) || !navigator.permissions?.query) {
          if (vivo) setPermisoGps('desconocido')
          return
        }
        estado = await navigator.permissions.query({ name: 'geolocation' })
        if (!vivo) return
        const actual = estado.state as 'granted' | 'denied' | 'prompt'
        setPermisoGps(actual)
        try { console.info(`[gps] permiso: ${actual}`) } catch { /* noop */ }
        estado.onchange = () => {
          const nuevo = estado?.state as 'granted' | 'denied' | 'prompt'
          try { console.info(`[gps] permiso cambió a: ${nuevo}`) } catch { /* noop */ }
          setPermisoGps(nuevo)
          if (nuevo === 'granted') reintentarGps()
          else if (nuevo === 'denied') {
            setGpsEstado((g) => (g === 'ok' ? g : 'denegado'))
            setGpsDetalle(null)
          }
        }
      } catch {
        if (vivo) setPermisoGps('desconocido')
      }
    })()
    return () => {
      vivo = false
      try { if (estado) estado.onchange = null } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Geolocalización en tiempo real: fix inmediato al abrir + seguimiento continuo.
  // El navegador pide permiso la primera vez; sin permiso se muestra Santiago
  // aproximado con aviso (nunca se simula una posición exacta).
  // Códigos de error: 1 = permiso denegado, 2 = sin señal/GPS apagado, 3 = timeout.
  function aplicarFixGps(p: GeolocationPosition, origen: string) {
    try {
      console.info(
        `[gps] fix ${origen}: ${p.coords.longitude.toFixed(5)},${p.coords.latitude.toFixed(5)} ±${Math.round(p.coords.accuracy ?? -1)}m`,
      )
    } catch { /* noop */ }
    setPos([p.coords.longitude, p.coords.latitude])
    setAcc(p.coords.accuracy)
    setGpsDetalle(null)
    setGpsEstado('ok')
  }

  function aplicarErrorGps(err: GeolocationPositionError, origen: string) {
    try {
      console.warn(`[gps] error ${origen} code=${err.code}: ${err.message}`)
    } catch { /* noop */ }
    if (err?.code === 1) {
      // Permiso denegado (incluye denegación recordada: el navegador ya no
      // vuelve a preguntar, hay que reactivarlo en el candado del sitio).
      setGpsEstado((g) => (g === 'ok' ? g : 'denegado'))
      setGpsDetalle(null)
      setAviso('Activa el GPS para verte en el mapa — mostrando Santiago aproximado.')
    } else if (err?.code === 2) {
      setGpsEstado((g) => (g === 'ok' ? g : 'error'))
      setGpsDetalle('Sin señal GPS o ubicación desactivada en el dispositivo.')
    } else {
      setGpsEstado((g) => (g === 'ok' ? g : 'error'))
      setGpsDetalle('El GPS tardó demasiado en responder (timeout).')
    }
  }

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsEstado('sin-soporte')
      return
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      // HTTP no-localhost: el navegador bloquea el GPS sin siquiera preguntar.
      setGpsEstado('sin-soporte')
      setGpsDetalle('Conexión no segura: usa HTTPS o localhost para activar el GPS.')
      return
    }
    // Fix inmediato (el watch puede tardar en el primer callback).
    navigator.geolocation.getCurrentPosition(
      (p) => aplicarFixGps(p, 'init'),
      (err) => aplicarErrorGps(err, 'init'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    )
    const id = navigator.geolocation.watchPosition(
      (p) => aplicarFixGps(p, 'watch'),
      (err) => aplicarErrorGps(err, 'watch'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reintento manual (chips GPS): vuelve a pedir permiso.
  // Si el navegador lo bloqueó de forma permanente, devuelve error al tiro
  // y el aviso indica que hay que activarlo en los ajustes del sitio.
  function reintentarGps() {
    if (!('geolocation' in navigator)) {
      setGpsEstado('sin-soporte')
      return
    }
    setGpsEstado('pendiente')
    setGpsDetalle(null)
    navigator.geolocation.getCurrentPosition(
      (p) => aplicarFixGps(p, 'retry'),
      (err) => {
        aplicarErrorGps(err, 'retry')
        if (err?.code === 1) {
          setAviso('Permiso denegado: actívalo en el candado de la barra de direcciones.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    )
  }

  // Mapa interactivo: init robusta + reintentos + controles nativos de respaldo.
  // - Nunca se cae a imagen estática por un tile suelto: solo 'error' si el
  //   STYLE no carga (red/CDN/WebGL) o el constructor lanza.
  // - mapIntento permite reintentar (alterna estilo primario/fallback).
  useEffect(() => {
    const container = mapRef.current
    if (!container) return
    let cancelado = false
    let raf = 0
    let timeoutEstilo = 0
    let timeoutAjuste = 0
    let timeoutAjuste2 = 0
    let intervaloSanacion = 0
    let observador: ResizeObserver | null = null
    let ajustarActual: (() => void) | null = null
    let rafAjuste = 0

    const crear = () => {
      if (cancelado || mapObj.current || !container.isConnected) return
      setMapEstado('cargando')
      setMapDetalle(null)
      // Sin WebGL no hay mapa posible: mensaje específico en vez de reintentar a ciegas.
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
        if (!gl) {
          setMapDetalle('Tu navegador bloqueó WebGL (modo seguro o drivers). Revisa chrome://gpu.')
          setMapEstado('error')
          return
        }
      } catch { /* si el check falla, intentar igual */ }
      try {
        container.innerHTML = ''
        // Estilo según tema vigente (se lee del DOM: siempre fresco).
        const oscuro = document.documentElement.classList.contains('dark')
        temaMapaRef.current = oscuro
        const estilo = mapIntento % 2 === 1
          ? MAP_STYLE_FALLBACK
          : oscuro ? MAP_STYLE_OSCURO : MAP_STYLE_CLARO
        try {
          console.info(
            `[mapa] crear contenedor=${container.clientWidth}x${container.clientHeight} estilo=${mapIntento % 2 === 1 ? 'fallback' : oscuro ? 'oscuro' : 'claro'}`,
          )
        } catch { /* noop */ }
        const map = new maplibregl.Map({
          container,
          style: estilo,
          center: estadoRef.current.pos,
          zoom: 14,
          attributionControl: false,
        })
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
        try {
          map.addControl(
            new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }),
            'bottom-right',
          )
        } catch { /* control opcional */ }
        try {
          map.addControl(
            new maplibregl.GeolocateControl({
              positionOptions: { enableHighAccuracy: true },
              trackUserLocation: true,
              showAccuracyCircle: true,
              showUserLocation: false, // usamos pin "Tú" propio
            }),
            'bottom-right',
          )
        } catch { /* control opcional */ }
        mapObj.current = map
        // Pin de ubicación con pulso azul + etiqueta "Tú"
        const wrap = document.createElement('div')
        wrap.style.cssText =
          'position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;'
        const ripple = document.createElement('span')
        ripple.className = 'pin-ripple'
        ripple.style.cssText =
          'position:absolute;width:44px;height:44px;border-radius:9999px;background:rgba(37,99,235,.3);animation-duration:2.5s;'
        const dot = document.createElement('span')
        dot.style.cssText =
          'position:relative;width:20px;height:20px;border-radius:9999px;background:#2563EB;border:4px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25),0 4px 12px rgba(0,0,0,.3);'
        const label = document.createElement('span')
        label.textContent = 'Tú'
        label.style.cssText =
          'position:absolute;top:100%;left:50%;transform:translateX(-50%);background:#2563EB;color:#fff;font-size:10px;font-weight:700;line-height:1;padding:3px 8px;border-radius:9999px;box-shadow:0 2px 8px rgba(37,99,235,.45);white-space:nowrap;'
        wrap.appendChild(ripple)
        wrap.appendChild(dot)
        wrap.appendChild(label)
        markerRef.current = new maplibregl.Marker({ element: wrap })
          .setLngLat(estadoRef.current.pos)
          .addTo(map)
        // Exploración libre: el click/drag NUNCA elige destino.
        // La selección se hace solo con el pin central (moveend) + "Confirmar Destino".
        // Se registra moveend siempre; el handler filtra por modo con seleccionandoRef.
        map.on('moveend', () => {
          try {
            const c = map.getCenter()
            if (seleccionandoRef.current) {
              setCentroMapa({ lat: c.lat, lng: c.lng })
              setCentroMovido(true)
            } else if (selReporteRef.current) {
              setCentroRep({ lat: c.lat, lng: c.lng })
            }
          } catch { /* noop */ }
        })
        // Marcar listo al cargar estilo; repintar por si el layout cambió.
        // 'load' dispara también tras cada setStyle (cambio de tema): se
        // bumpéa estiloKey para redibujar las capas propias (ruta, zonas).
        map.on('load', () => {
          if (cancelado) return
          window.clearTimeout(timeoutEstilo)
          try { map.resize() } catch { /* noop */ }
          setMapDetalle(null)
          setMapEstado('listo')
          setEstiloKey((k) => k + 1)
        })
        // El canvas de MapLibre congela su tamaño al inicializar: si el
        // contenedor cambia después (fuentes, header, dvh móvil), quedaba
        // una franja delgada con tiles + resto blanco. El observador lo
        // mantiene sincronizado de forma permanente.
        const ajustar = () => {
          if (cancelado) return
          cancelAnimationFrame(rafAjuste)
          rafAjuste = requestAnimationFrame(() => {
            try { map.resize() } catch { /* noop */ }
          })
        }
        ajustarActual = ajustar
        try {
          observador = new ResizeObserver(ajustar)
          observador.observe(container)
        } catch { /* ResizeObserver opcional */ }
        window.addEventListener('resize', ajustar)
        // Ajustes diferidos por si el layout se asienta tarde (anti-franja).
        timeoutAjuste = window.setTimeout(ajustar, 500)
        timeoutAjuste2 = window.setTimeout(ajustar, 1500)
        // Auto-sanación: si el canvas quedó con tamaño distinto al contenedor
        // (init durante un layout transitorio como 135x48), corregirlo en
        // cuanto diverjan. Cubre el caso en que el contenedor ya NO vuelve a
        // cambiar de tamaño (ahí el ResizeObserver nunca dispararía).
        try { window.clearInterval(intervaloSanacion) } catch { /* noop */ }
        intervaloSanacion = window.setInterval(() => {
          if (cancelado) return
          const m = mapObj.current
          if (!m) return
          try {
            const cw = container.clientWidth
            const ch = container.clientHeight
            const canvas = container.querySelector('canvas.maplibregl-canvas')
            if (!canvas || cw === 0 || ch === 0) return
            const dw = Math.abs(canvas.clientWidth - cw)
            const dh = Math.abs(canvas.clientHeight - ch)
            if (dw > 2 || dh > 2) {
              try { m.resize() } catch { /* noop */ }
            }
          } catch { /* noop */ }
        }, 1000)
        // NOTA: no usamos map.on('error') para marcar error. Los errores de
        // tiles/fuentes son normales durante la carga y tumbaban el mapa
        // con el filtro anterior (/source/i). Solo el timeout de estilo
        // declara el fallo, con auto-fallback al estilo secundario.
        // Si el estilo no carga, auto-intentar con el otro estilo una vez
        // antes de mostrar error (no pedir click al usuario).
        timeoutEstilo = window.setTimeout(() => {
          if (cancelado || !mapObj.current) return
          try {
            if (map.isStyleLoaded()) return
          } catch { return }
          if (mapIntento < 1) {
            // Primer fallo (Carto): probar OpenFreeMap automáticamente.
            setMapIntento((n) => n + 1)
          } else {
            setMapDetalle(
              'No se pudo descargar el estilo (red, adblock o dominio bloqueado en DevTools → Network request blocking).',
            )
            setMapEstado('error')
          }
        }, 12_000)
      } catch (e) {
        if (!cancelado) {
          setMapDetalle(e instanceof Error ? e.message : 'Falló la creación del mapa.')
          setMapEstado('error')
        }
      }
    }

    // Esperar tamaño ESTABLE y significativo antes de crear el mapa.
    // El bug de la franja (canvas de 966×48): el gate anterior aceptaba
    // cualquier alto > 0, así que si el primer paint medía 48px, el canvas
    // quedaba congelado en franja delgada. Se exige alto mínimo + 3 frames
    // estables, con tope de espera para no bloquear nunca la creación
    // (luego el ResizeObserver + ajustes diferidos corrigen lo que falte).
    const ALTO_MIN = 200
    const ESPERA_MAX_MS = 5000
    const t0 = performance.now()
    let ultimoW = 0
    let ultimoH = 0
    let estables = 0
    const esperarTamano = () => {
      if (cancelado) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w > 0 && h >= ALTO_MIN && w === ultimoW && h === ultimoH) {
        estables += 1
      } else {
        estables = 0
      }
      ultimoW = w
      ultimoH = h
      if (estables >= 3 || performance.now() - t0 > ESPERA_MAX_MS) {
        crear()
      } else {
        raf = requestAnimationFrame(esperarTamano)
      }
    }
    raf = requestAnimationFrame(esperarTamano)

    return () => {
      cancelado = true
      cancelAnimationFrame(raf)
      cancelAnimationFrame(rafAjuste)
      window.clearTimeout(timeoutEstilo)
      window.clearTimeout(timeoutAjuste)
      window.clearTimeout(timeoutAjuste2)
      window.clearInterval(intervaloSanacion)
      intervaloSanacion = 0
      try { observador?.disconnect() } catch { /* noop */ }
      observador = null
      if (ajustarActual) {
        try { window.removeEventListener('resize', ajustarActual) } catch { /* noop */ }
        ajustarActual = null
      }
      try { markerRef.current?.remove() } catch { /* noop */ }
      markerRef.current = null
      try { previewMarkerRef.current?.remove() } catch { /* noop */ }
      previewMarkerRef.current = null
      try { destMarkerRef.current?.remove() } catch { /* noop */ }
      destMarkerRef.current = null
      try { mapObj.current?.remove() } catch { /* noop */ }
      mapObj.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapIntento])

  function reintentarMapa() {
    try { mapObj.current?.remove() } catch { /* noop */ }
    mapObj.current = null
    markerRef.current = null
    previewMarkerRef.current = null
    destMarkerRef.current = null
    setMapDetalle(null)
    setMapEstado('cargando')
    setMapIntento((n) => n + 1)
  }

  useEffect(() => {
    markerRef.current?.setLngLat(pos)
    if (mapObj.current && !rutaActiva && gpsEstado === 'ok') {
      try {
        if (!fijadoInicial.current) {
          // Primer fix real: volar desde Santiago (default) a donde estás parado.
          fijadoInicial.current = true
          mapObj.current.flyTo({ center: pos, zoom: 16, duration: 1200 })
        } else {
          mapObj.current.easeTo({ center: pos, duration: 500 })
        }
      } catch { /* noop */ }
    }
  }, [pos, rutaActiva, gpsEstado])

  // Timer ruta
  useEffect(() => {
    if (!rutaActiva) {
      setElapsed(0)
      return
    }
    const t = setInterval(() => setElapsed(Date.now() - rutaActiva.inicioEpoch), 1000)
    return () => clearInterval(t)
  }, [rutaActiva])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2600)
    return () => clearTimeout(t)
  }, [aviso])

  // Cargar contactos + historial (tolerante si la migración 006 aún no corre)
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { data, error } = await supabase.from('contactos').select('id,nombre,telefono,relacion').eq('usuario_id', user.id).limit(5)
        if (!error && data) {
          setContactos(data.map((c, i) => ({
            ...c,
            lat: pos[1] + 0.004 * (i + 1),
            lng: pos[0] + 0.004 * (i + 1),
          })) as Contacto[])
        }
      } catch { /* noop */ }
      try {
        const { data, error } = await supabase.from('rutas').select('id,origen,destino,inicio,fin,estado')
          .eq('usuario_id', user.id).order('inicio', { ascending: false }).limit(20)
        if (!error && data) setHistorial(data as never)
      } catch { /* noop */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Reportes comunitarios: carga + refresco cada 60 s ──────────────
  async function cargarReportes() {
    try {
      const { data, error } = await supabase.from('reportes')
        .select('id,usuario_id,lat,lng,categoria,gravedad,descripcion,creado_en')
        .gt('expira_en', new Date().toISOString())
        .order('creado_en', { ascending: false })
        .limit(100)
      if (!error && data) setReportes(data as Reporte[])
    } catch { /* sin red: se conservan los ya cargados */ }
  }

  useEffect(() => {
    if (!user) return
    cargarReportes()
    const t = window.setInterval(cargarReportes, 60_000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Reintento cuando el mapa está listo (cubre carreras carga-mapa vs fetch).
  useEffect(() => {
    if (mapEstado === 'listo') cargarReportes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEstado])

  // Tiempo real en efecto aparte: si realtime falla, jamás afecta la carga.
  useEffect(() => {
    if (!user) return
    const canal = supabase
      .channel('reportes-mapa')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes' }, () => cargarReportes())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reportes' }, () => cargarReportes())
    try {
      canal.subscribe()
    } catch { /* realtime opcional */ }
    return () => {
      try {
        supabase.removeChannel(canal)
      } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Reportes visibles: color + opacidad vigentes, rojos al final
  // (se pintan encima en la capa y llevan mayor zIndex en pines) ──────
  interface ReporteVisible extends Reporte {
    color: string
    op: number
  }
  const reportesVisibles = useMemo<ReporteVisible[]>(() => {
    const ahora = Date.now()
    return reportes
      .map((r) => {
        const color = colorReporte(r, ahora)
        if (!color || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return null
        return { ...r, color, op: opacidadReporte(r.creado_en, ahora) }
      })
      .filter((r): r is ReporteVisible => r != null)
      .sort((a, b) => RANK_GRAVEDAD[a.gravedad] - RANK_GRAVEDAD[b.gravedad])
  }, [reportes])

  const reportesDeps = useMemo(
    () => `${mapEstado}:${reportesVisibles.map((r) => `${r.id}:${r.gravedad}`).join(',')}`,
    [mapEstado, reportesVisibles],
  )

  // ── Clustering: al alejar, burbujas con conteo en vez de pines ──────
  type ClusterItem = {
    properties: { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string }
    geometry: { coordinates: [number, number] }
  }
  const clusterIdx = useMemo(() => {
    const idx = new Supercluster({ radius: 60, maxZoom: 15 })
    idx.load(
      reportesVisibles.map((r) => ({
        type: 'Feature' as const,
        properties: { id: r.id },
        geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] as [number, number] },
      })),
    )
    return idx
  }, [reportesVisibles])

  const [clusters, setClusters] = useState<ClusterItem[]>([])

  const actualizarClusters = useCallback(() => {
    const map = mapObj.current
    if (!map) return
    try {
      const b = map.getBounds()
      setClusters(
        clusterIdx.getClusters(
          [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          Math.floor(map.getZoom()),
        ) as unknown as ClusterItem[],
      )
    } catch { /* noop */ }
  }, [clusterIdx])

  // Recalcular clusters al mover/zoom y cuando el mapa o los datos están listos
  useEffect(() => {
    const map = mapObj.current
    if (!map || mapEstado !== 'listo') return
    actualizarClusters()
    map.on('moveend', actualizarClusters)
    return () => {
      try {
        map.off('moveend', actualizarClusters)
      } catch { /* noop */ }
    }
  }, [mapEstado, clusterIdx, actualizarClusters])

  function htmlReporte(r: ReporteVisible, esMio: boolean, oscuro: boolean): string {
    const txt = oscuro ? '#E2E8F0' : '#0F172A'
    const sub = oscuro ? '#94A3B8' : '#64748B'
    return (
      `<div style="font-family:inherit;min-width:140px">` +
      `<p style="margin:0;font-size:11px;font-weight:700;color:${r.color}">${ETIQUETA_CATEGORIA[r.categoria]} · ${edadCorta(r.creado_en)}</p>` +
      (r.descripcion
        ? `<p style="margin:4px 0 0;font-size:12px;color:${txt}">${r.descripcion.replace(/</g, '&lt;')}</p>`
        : `<p style="margin:4px 0 0;font-size:12px;color:${sub}">Reporte de la comunidad</p>`) +
      // Borrar solo el propio: el RLS lo refuerza en el servidor.
      (esMio
        ? `<button data-eliminar-reporte="${r.id}" style="margin-top:8px;display:inline-flex;align-items:center;gap:4px;border:1px solid #FECACA;background:#FEF2F2;color:#DC2626;font-size:11px;font-weight:700;border-radius:9999px;padding:4px 10px;cursor:pointer">🗑 Eliminar</button>`
        : ``) +
      `</div>`
    )
  }

  // Popup ÚNICO: abrir uno cierra automáticamente el anterior.
  function abrirPopupReporte(r: ReporteVisible) {
    const map = mapObj.current
    if (!map) return
    const esMio = !!user && r.usuario_id === user.id
    try {
      popupRef.current?.remove()
      popupRef.current = null
      const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: '240px' })
        .setLngLat([r.lng, r.lat])
        .setHTML(htmlReporte(r, esMio, document.documentElement.classList.contains('dark')))
      popup.on('close', () => {
        popupRef.current = null
        setActiveReportId(null)
      })
      popup.addTo(map)
      popupRef.current = popup
      setActiveReportId(r.id)
      // Botón eliminar (solo propio): vive en HTML, se cablea aquí.
      if (esMio) {
        try {
          popup
            .getElement()
            .querySelector('[data-eliminar-reporte]')
            ?.addEventListener('click', (ev) => {
              ev.stopPropagation()
              eliminarReporte(r.id)
            })
        } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }

  // Borrar el propio reporte: confirm → DELETE (RLS: solo el dueño) →
  // filtro local instantáneo + popup cerrado + toast.
  async function eliminarReporte(id: string) {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este reporte?')) return
    try {
      const { error } = await supabase.from('reportes').delete().eq('id', id)
      if (error) throw error
      setReportes((prev) => prev.filter((r) => r.id !== id))
      try {
        popupRef.current?.remove()
        popupRef.current = null
      } catch { /* noop */ }
      setActiveReportId(null)
      setAviso('Reporte eliminado.')
    } catch {
      setAviso('No se pudo eliminar el reporte. Intenta de nuevo.')
    }
  }

  // Resalta el pin activo (más grande) sin recrear marcadores
  useEffect(() => {
    markerElsRef.current.forEach((elm, id) => {
      elm.style.transform = id === activeReportId ? 'rotate(-45deg) scale(1.35)' : 'rotate(-45deg)'
    })
  }, [activeReportId])

  useEffect(() => {
    const map = mapObj.current
    if (!map) return
    if (tab !== 'inicio') {
      popupRef.current?.remove()
      popupRef.current = null
      return
    }
    const markers: maplibregl.Marker[] = []
    markerElsRef.current.clear()

    // ── Zonas: capa fill + borde desde GeoJSON (una sola fuente) ──
    const dibujarZonas = () => {
      try {
        for (const id of ['reportes-zona-fill', 'reportes-zona-linea']) {
          if (map.getLayer(id)) map.removeLayer(id)
        }
        if (map.getSource('reportes-zona')) map.removeSource('reportes-zona')
        const feats = reportesVisibles.map((r) => ({
          type: 'Feature',
          properties: { color: r.color, opacidad: r.op, id: r.id },
          geometry: { type: 'Polygon', coordinates: [circuloZona(r.lng, r.lat)] },
        }))
        if (feats.length === 0) return
        map.addSource('reportes-zona', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: feats },
        } as never)
        map.addLayer({
          id: 'reportes-zona-fill',
          type: 'fill',
          source: 'reportes-zona',
          // Time decay: la zona se vuelve "fantasma" con la edad
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacidad'] },
        })
        map.addLayer({
          id: 'reportes-zona-linea',
          type: 'line',
          source: 'reportes-zona',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': ['min', ['+', ['get', 'opacidad'], 0.2], 0.9],
          },
        })
      } catch { /* estilo aún no listo: reintenta en 'load' */ }
    }
    try {
      if (map.isStyleLoaded()) dibujarZonas()
      else map.once('load', dibujarZonas)
    } catch { /* noop */ }

    // ── Pines: burbuja de cluster al alejar, pin individual al acercar ──
    // Rojo encima de amarillo encima de azul (zIndex) + opacidad por edad.
    const porId = new Map(reportesVisibles.map((r) => [r.id, r]))
    clusters.forEach((c) => {
      const [lng, lat] = c.geometry.coordinates
      // Burbuja de cluster: conteo + zoom al tocar
      if (c.properties.cluster) {
        const n = c.properties.point_count ?? 2
        const tam = n >= 10 ? 46 : 38
        const el = document.createElement('button')
        el.type = 'button'
        el.title = `${n} reportes — toca para acercar`
        el.setAttribute('aria-label', el.title)
        el.style.cssText =
          `width:${tam}px;height:${tam}px;border-radius:9999px;background:rgba(255,255,255,.95);` +
          'border:3px solid #2563EB;color:#1D4ED8;font-weight:800;font-size:13px;' +
          'box-shadow:0 4px 16px rgba(37,99,235,.35);cursor:pointer;'
        el.textContent = String(n)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          try {
            const z = clusterIdx.getClusterExpansionZoom(c.properties.cluster_id as number)
            map.easeTo({ center: [lng, lat], zoom: Math.min(z, 18), duration: 500 })
          } catch { /* noop */ }
        })
        markers.push(new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map))
        return
      }
      const r = porId.get(c.properties.id as string)
      if (!r) return
      const el = document.createElement('button')
      el.type = 'button'
      el.title = `${ETIQUETA_CATEGORIA[r.categoria]} · ${edadCorta(r.creado_en)}`
      el.setAttribute('aria-label', el.title)
      el.style.cssText =
        'width:26px;height:26px;border-radius:9999px 9999px 9999px 0;display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;'
      el.style.background = r.color
      el.style.opacity = String(Math.min(1, r.op + 0.2))
      el.style.zIndex = String(10 + RANK_GRAVEDAD[r.gravedad] * 10)
      if (r.id === activeReportId) el.style.transform = 'rotate(-45deg) scale(1.35)'
      const punto = document.createElement('span')
      punto.style.cssText =
        'width:8px;height:8px;border-radius:9999px;background:#fff;transform:rotate(45deg);'
      el.appendChild(punto)
      const marker = new maplibregl.Marker({ element: el }).setLngLat([r.lng, r.lat])
      marker.getElement().addEventListener('click', (ev) => {
        ev.stopPropagation()
        abrirPopupReporte(r)
      })
      marker.addTo(map)
      markers.push(marker)
      markerElsRef.current.set(r.id, el)
    })
    return () => {
      markers.forEach((m) => m.remove())
      try {
        const mp = mapObj.current
        if (mp) {
          for (const id of ['reportes-zona-fill', 'reportes-zona-linea']) {
            if (mp.getLayer(id)) mp.removeLayer(id)
          }
          if (mp.getSource('reportes-zona')) mp.removeSource('reportes-zona')
        }
      } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportesDeps, clusters, tab, clusterIdx, estiloKey])

  async function enviarReporte() {
    if (!user) return
    if (formRep.categoria === '' || formRep.gravedad === '') {
      setAviso('Elige categoría y gravedad para enviar el reporte.')
      return
    }
    // Ubicación exacta: la elegida en el mapa o el GPS actual.
    const rl = reportLoc ?? { lat: pos[1], lng: pos[0] }
    setRepGuardando(true)
    try {
      const { error } = await supabase.from('reportes').insert({
        usuario_id: user.id,
        lat: rl.lat,
        lng: rl.lng,
        categoria: formRep.categoria,
        gravedad: formRep.gravedad,
        descripcion: formRep.descripcion.trim() || null,
        expira_en: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      })
      if (error) throw error
      setFormRep({ categoria: '', gravedad: '', descripcion: '' })
      setReportLoc(null)
      setShowReporte(false)
      setAviso('Reporte enviado. Gracias por cuidar a la comunidad.')
      // Re-render inmediato + vuelo a la zona: el pin aparece sin recargar
      // y el usuario lo ve aunque estuviera fuera de pantalla.
      cargarReportes()
      try {
        mapObj.current?.flyTo({ center: [rl.lng, rl.lat], zoom: 15, duration: 900 })
      } catch { /* noop */ }
    } catch (e) {
      setAviso(
        `No se pudo enviar el reporte${e instanceof Error && e.message ? `: ${e.message.slice(0, 120)}` : '. Intenta de nuevo.'}`,
      )
    } finally {
      setRepGuardando(false)
    }
  }
  // Pines de contactos
  const pinesDeps = useMemo(() => contactos.map((c) => c.id).join(','), [contactos])
  useEffect(() => {
    const map = mapObj.current
    if (!map) return
    const markers: maplibregl.Marker[] = []
    contactos.forEach((c) => {
      if (c.lat == null || c.lng == null) return
      const el = document.createElement('div')
      el.title = c.nombre
      el.style.cssText =
        'width:14px;height:14px;border-radius:9999px;background:#10B981;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);'
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map))
    })
    return () => markers.forEach((m) => m.remove())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinesDeps, estiloKey])

  // Polyline de la ruta: azul #2563EB gruesa con glow sutil
  useEffect(() => {
    const map = mapObj.current
    if (!map) return
    const dibujar = () => {
      try {
        for (const id of ['ruta-halo', 'ruta-linea']) {
          if (map.getLayer(id)) map.removeLayer(id)
        }
        if (map.getSource('ruta-linea')) map.removeSource('ruta-linea')
        if (lineaRuta && lineaRuta.length > 1) {
          map.addSource('ruta-linea', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: lineaRuta },
            },
          })
          map.addLayer({
            id: 'ruta-halo',
            type: 'line',
            source: 'ruta-linea',
            paint: { 'line-color': '#2563EB', 'line-width': 12, 'line-opacity': 0.18, 'line-blur': 4 },
          })
          map.addLayer({
            id: 'ruta-linea',
            type: 'line',
            source: 'ruta-linea',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#2563EB', 'line-width': 6, 'line-opacity': 1 },
          })
        }
      } catch { /* noop */ }
    }
    try {
      if (map.isStyleLoaded()) dibujar()
      else map.once('load', dibujar)
    } catch { /* noop */ }
  }, [lineaRuta, estiloKey])

  async function activarSOS() {
    // SIN confirmación — spec §6.3 / §9
    setAlerta(true)
    setShowSosModal(true)
    try {
      await supabase.from('alertas').insert({
        usuario_id: user?.id,
        tipo: 'sos',
        lat: pos[1],
        lng: pos[0],
        estado: 'activa',
      })
    } catch {
      /* la tabla puede no existir aún en local; la alerta visual no se bloquea */
    }
  }

  // ── Pin central: entrar / salir / confirmar ──────────────────────────
  // El mapa es 100% explorable (click, drag, zoom no eligen nada).
  // Solo al confirmar se geocodifica y se traza la ruta.
  function iniciarSeleccionEnMapa() {
    if (rutaActiva || !mapObj.current) return
    limpiarPreview()
    setSelReporte(false)
    setCentroRep(null)
    try {
      const c = mapObj.current.getCenter()
      setCentroMapa({ lat: c.lat, lng: c.lng })
    } catch {
      setCentroMapa({ lat: pos[1], lng: pos[0] })
    }
    setCentroMovido(false)
    setSeleccionandoDestino(true)
  }

  function cancelarSeleccion() {
    setSeleccionandoDestino(false)
    setCentroMapa(null)
    setCentroMovido(false)
  }

  // ── Opción A: control segmentado de modos ───────────────────────────
  const modoMapa: 'explorar' | 'elegir' = seleccionandoDestino ? 'elegir' : 'explorar'
  function setModoMapa(m: 'explorar' | 'elegir') {
    if (m === 'elegir') iniciarSeleccionEnMapa()
    else cancelarSeleccion()
  }

  async function confirmarCentro() {
    const c = centroMapa ?? (() => {
      try {
        const m = mapObj.current?.getCenter()
        return m ? { lat: m.lat, lng: m.lng } : null
      } catch { return null }
    })()
    if (!c || previewCargando) return
    const { pos: p } = estadoRef.current
    const { lat, lng } = c
    setPreview({ lat, lng, etiqueta: 'Buscando dirección…' })
    setPreviewInfo(null)
    setPreviewLinea(null)
    setPreviewCargando(true)
    setSeleccionandoDestino(false)
    setCentroMovido(false)
    ;(async () => {
      try {
        const [dir, ruta] = await Promise.all([
          direccionDesdeCoords(lat, lng).catch(() => null),
          obtenerRutaCalles([p[0], p[1]], [lng, lat]),
        ])
        setPreview({
          lat,
          lng,
          etiqueta: dir ?? `Punto del mapa · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        })
        if (ruta) {
          setPreviewInfo({ distanciaM: ruta.distanciaM, duracionS: ruta.duracionS })
          setPreviewLinea(ruta.coords)
        } else {
          setPreviewLinea([[p[0], p[1]], [lng, lat]])
        }
      } finally {
        setPreviewCargando(false)
      }
    })()
  }

  // ── Ubicación del reporte: pin central + volver al modal ──────────
  // El modal se minimiza, el mapa entra en modo selección y al confirmar
  // las coords vuelven al formulario (el borrador se conserva).
  function abrirSelectorReporte() {
    if (!mapObj.current) return
    cancelarSeleccion()
    setShowReporte(false)
    try {
      const c = mapObj.current.getCenter()
      setCentroRep({ lat: c.lat, lng: c.lng })
    } catch {
      setCentroRep({ lat: pos[1], lng: pos[0] })
    }
    setSelReporte(true)
  }

  function confirmarUbicacionReporte() {
    let c = centroRep
    if (!c) {
      try {
        const m = mapObj.current?.getCenter()
        c = m ? { lat: m.lat, lng: m.lng } : null
      } catch {
        c = null
      }
    }
    if (!c) return
    setReportLoc(c)
    setSelReporte(false)
    setCentroRep(null)
    setShowReporte(true)
  }

  function cancelarSelectorReporte() {
    setSelReporte(false)
    setCentroRep(null)
    setShowReporte(true)
  }

  function limpiarPreview() {    setPreview(null)
    setPreviewInfo(null)
    setPreviewLinea(null)
    setPreviewCargando(false)
  }

  // Salir de los modos de selección si cambia de tab o inicia ruta
  useEffect(() => {
    if (tab !== 'inicio' || rutaActiva) {
      setSeleccionandoDestino(false)
      setCentroMapa(null)
      setCentroMovido(false)
      setSelReporte(false)
      setCentroRep(null)
    }
  }, [tab, rutaActiva])

  // Pin rojo del destino en previa + línea punteada (se confirma o se limpia)
  useEffect(() => {
    previewMarkerRef.current?.remove()
    previewMarkerRef.current = null
    const map = mapObj.current
    if (!map || !preview) return
    try {
      const el = document.createElement('div')
      el.title = preview.etiqueta
      el.style.cssText =
        'width:22px;height:22px;border-radius:9999px 9999px 9999px 0;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);transform:rotate(-45deg);'
      previewMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([preview.lng, preview.lat])
        .addTo(map)
    } catch { /* noop */ }
    return () => {
      previewMarkerRef.current?.remove()
      previewMarkerRef.current = null
    }
  }, [preview])

  useEffect(() => {
    const map = mapObj.current
    if (!map) return
    const dibujar = () => {
      try {
        if (map.getLayer('ruta-preview')) map.removeLayer('ruta-preview')
        if (map.getLayer('ruta-preview-casing')) map.removeLayer('ruta-preview-casing')
        if (map.getSource('ruta-preview')) map.removeSource('ruta-preview')
        if (previewLinea && previewLinea.length > 1) {
          map.addSource('ruta-preview', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: previewLinea },
            },
          })
          map.addLayer({
            id: 'ruta-preview-casing',
            type: 'line',
            source: 'ruta-preview',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.9 },
          })
          map.addLayer({
            id: 'ruta-preview',
            type: 'line',
            source: 'ruta-preview',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#2563EB',
              'line-width': 4,
              'line-opacity': 0.9,
              'line-dasharray': [2, 2],
            },
          })
        }
      } catch { /* noop */ }
    }
    try {
      if (map.isStyleLoaded()) dibujar()
      else map.once('load', dibujar)
    } catch { /* noop */ }
  }, [previewLinea, estiloKey])

  async function activarRuta(
    destinoTxt: string,
    destCoords: { lat: number; lng: number } | null,
    origenTxtOverride?: string,
    origenCoordsOverride?: { lat: number; lng: number } | null,
  ) {
    if (!user) return
    const inicioIso = new Date().toISOString()
    // Origen: manual exacto si el usuario lo escribió/eligió, si no GPS actual.
    const oLng = origenCoordsOverride?.lng ?? pos[0]
    const oLat = origenCoordsOverride?.lat ?? pos[1]
    let origenTxt = origenTxtOverride?.trim() || dirActual
    if (!origenTxt) {
      try {
        origenTxt = (await direccionDesdeCoords(oLat, oLng)) ?? 'Ubicación actual'
      } catch {
        origenTxt = 'Ubicación actual'
      }
      setDirActual(origenTxt)
    }
    let id = uid()
    try {
      const { data, error } = await supabase.from('rutas').insert({
        usuario_id: user.id,
        origen: origenTxt,
        origen_lat: oLat,
        origen_lng: oLng,
        destino: destinoTxt,
        destino_lat: destCoords?.lat ?? null,
        destino_lng: destCoords?.lng ?? null,
        inicio: inicioIso,
        estado: 'activa',
      }).select('id').maybeSingle()
      if (!error && data?.id) id = data.id
    } catch { /* tolerante */ }
    iniciarRuta({ id, origen: origenTxt, destino: destinoTxt, inicioEpoch: Date.now(), destinoLat: destCoords?.lat, destinoLng: destCoords?.lng })
    // Ruta real por calles (no bloquea la activación)
    if (destCoords) {
      const o: [number, number] = [oLng, oLat]
      const d: [number, number] = [destCoords.lng, destCoords.lat]
      obtenerRutaCalles(o, d).then((r) => {
        if (r) {
          setLineaRuta(r.coords)
          setInfoRuta({ distanciaM: r.distanciaM, duracionS: r.duracionS })
        } else {
          setLineaRuta([o, d])
          setInfoRuta(null)
        }
      })
    } else {
      setLineaRuta(null)
      setInfoRuta(null)
    }
    // El operador saluda y su chat se abre automáticamente con la ruta.
    console.log('🟢 Ruta activada')
    pushMensaje({ id: uid(), emisor: 'operador', contenido: MENSAJE_BIENVENIDA_OPERADOR, creado_en: new Date().toISOString() })
    setShowChat(true)
    setAviso('Ruta segura activada. Tu círculo fue notificado.')
  }

  async function confirmarRuta() {
    if (!destino.trim() || !user) return
    const origenTxt = origen.trim() || dirActual || 'Ubicación actual'
    const origenCoords = origenSel ? { lat: origenSel.lat, lng: origenSel.lng } : null
    await activarRuta(destino.trim(), destSel ? { lat: destSel.lat, lng: destSel.lng } : null, origenTxt, origenCoords)
    setShowRuta(false)
    setDestino('')
    setDestSel(null)
    setSugs([])
  }

  async function confirmarPreview() {
    if (!preview || previewCargando || !user) return
    await activarRuta(preview.etiqueta, { lat: preview.lat, lng: preview.lng })
    limpiarPreview()
  }

  async function terminarRuta() {
    if (!rutaActiva || !user) return
    try {
      await supabase.from('rutas').update({ fin: new Date().toISOString(), estado: 'completada' }).eq('id', rutaActiva.id)
    } catch { /* tolerante */ }
    setHistorial([
      {
        id: rutaActiva.id,
        origen: rutaActiva.origen,
        destino: rutaActiva.destino,
        inicio: new Date(rutaActiva.inicioEpoch).toISOString(),
        fin: new Date().toISOString(),
        estado: 'completada',
      },
      ...historial,
    ])
    // La despedida pertenece a la sesión que se cierra: se guarda antes de
    // finalizar para que quede en el historial de esa sesión.
    pushMensaje({ id: uid(), emisor: 'operador', contenido: MENSAJE_FIN_RUTA_OPERADOR, creado_en: new Date().toISOString() })
    finalizarRuta()
    setLineaRuta(null)
    setInfoRuta(null)
    setOperadorEscribiendo(false)
    setAviso('Ruta finalizada. ¡Bien hecho!')
  }

  async function agregarContacto() {
    if (!user) return
    if (contactos.length >= 5) {
      setAviso('Máximo 5 contactos en tu círculo.')
      return
    }
    if (!formC.nombre.trim() || !formC.telefono.trim()) {
      setAviso('Completa nombre y teléfono.')
      return
    }
    let id = uid()
    try {
      const { data, error } = await supabase.from('contactos').insert({
        usuario_id: user.id,
        nombre: formC.nombre.trim(),
        telefono: formC.telefono.trim(),
        relacion: formC.relacion,
      }).select('id').maybeSingle()
      if (!error && data?.id) id = data.id
    } catch { /* tolerante */ }
    setContactos([...contactos, { id, nombre: formC.nombre.trim(), telefono: formC.telefono.trim(), relacion: formC.relacion }])
    setFormC({ nombre: '', telefono: '', relacion: 'familia' })
    setShowContacto(false)
  }

  async function eliminarContacto(id: string) {
    try {
      await supabase.from('contactos').delete().eq('id', id)
    } catch { /* tolerante */ }
    setContactos(contactos.filter((c) => c.id !== id))
  }

  function compartirUbicacion(c: Contacto) {
    const texto = `Hola ${c.nombre}, estoy en https://maps.google.com/?q=${pos[1]},${pos[0]} — CuidaChile`
    if (navigator.share) {
      navigator.share({ title: 'Mi ubicación — CuidaChile', text: texto }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(texto).catch(() => {})
      setAviso('Ubicación copiada al portapapeles.')
    }
  }

  function enviarChat(texto: string) {
    // Sesión finalizada: no se aceptan mensajes (el input ya viene bloqueado).
    if (useSeguridad.getState().sesionFinalizada) {
      setAviso('Tu ruta anterior finalizó. Inicia una nueva ruta para chatear.')
      return
    }
    // Throttle: 1 mensaje cada 5 s para cuidar el RPM gratuito.
    const ahoraEnvio = Date.now()
    if (ahoraEnvio - ultimoEnvioRef.current < UMBRAL_ENVIO_MS) {
      setAviso('Espera unos segundos antes de enviar otro mensaje.')
      return
    }
    ultimoEnvioRef.current = ahoraEnvio
    // Historial previo (sin el mensaje actual) como contexto para la IA.
    const previos = useSeguridad.getState().mensajes
      .slice(-10)
      .map((m) => ({ emisor: m.emisor, contenido: m.contenido }))
    pushMensaje({ id: uid(), emisor: 'usuario', contenido: texto, creado_en: new Date().toISOString() })
    // El operador responde solo durante una ruta activa sin alerta SOS.
    const { rutaActiva: hayRuta, alertaActiva: hayAlerta } = useSeguridad.getState()
    if (!hayRuta || hayAlerta) return
    console.log('💬 mensaje al operador…')
    setOperadorEscribiendo(true)
    // Solo gana la primera respuesta (IA o aviso): evita duplicados si la IA llega tarde.
    let resuelto = false
    const responder = (textoResp: string, sugiereSOS: boolean, fuente: 'gemini' | 'reglas' | 'sistema') => {
      if (resuelto) return
      resuelto = true
      setOperadorEscribiendo(false)
      const estado = useSeguridad.getState()
      if (!estado.rutaActiva || estado.alertaActiva) return
      console.log(`👤 ${OPERADOR_NOMBRE} responde (${fuente})${sugiereSOS ? ' (sugiere SOS)' : ''}`)
      estado.pushMensaje({
        id: uid(),
        emisor: 'operador',
        contenido: textoResp,
        creado_en: new Date().toISOString(),
        accion: sugiereSOS ? 'sugerirSOS' : undefined,
      })
    }
    // Fallo de la IA (alta demanda, timeout, sin red): burbuja amable en el
    // chat en vez de romper la app. Si el mensaje olía a peligro, se adjunta
    // igual el botón directo al SOS.
    const avisarFallo = (motivo: string) => {
      console.warn(`⚠️ IA no disponible (${motivo}), mostrando aviso en el chat`)
      responder(MENSAJE_FALLO_IA, detectarPeligro(texto), 'sistema')
    }
    // La Edge Function devuelve el mensaje de descanso (429/cuota) en el body
    // del error; supabase-js lo expone como error.context (Response u objeto).
    // Se extrae para mostrarlo tal cual en vez del genérico de conexión.
    const extraerMensajeCuota = async (error: unknown): Promise<string | null> => {
      try {
        const ctx = (error as { context?: unknown })?.context
        let body: unknown = null
        if (ctx instanceof Response) {
          body = await ctx.clone().json().catch(() => null)
        } else if (typeof ctx === 'object' && ctx !== null) {
          body = ctx
        } else if (typeof ctx === 'string') {
          try {
            body = JSON.parse(ctx)
          } catch {
            body = null
          }
        }
        const msg = (body as { error?: unknown } | null)?.error
        if (typeof msg === 'string' && /tomando un descanso|limite de mensajes/i.test(msg.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
          return msg
        }
      } catch {
        /* noop */
      }
      return null
    }
    // Límite: si la IA tarda demasiado, se avisa en el chat.
    const esperaMax = window.setTimeout(() => avisarFallo('timeout 60s'), TIEMPO_MAX_IA_MS)
    // supabase.functions.invoke envía solo el body (mensaje + historial + ubicación);
    // los headers (Content-Type: application/json, apikey, Authorization)
    // los pone automáticamente el cliente de Supabase. No hardcodear la key aquí.
    // La ubicación permite a Cristián mencionar reportes cercanos (chat-operador).
    const posChat = estadoRef.current.pos
    supabase.functions.invoke<{ texto?: string; error?: string }>('chat-operador', {
      body: {
        mensaje: texto,
        historial: previos,
        ubicacion: { lat: posChat[1], lng: posChat[0] },
      },
    })
      .then(async ({ data, error }) => {
        window.clearTimeout(esperaMax)
        // Éxito: burbuja con el texto de Gemini.
        if (!error && data?.texto?.trim()) {
          responder(data.texto.trim(), detectarPeligro(texto), 'gemini')
          return
        }
        // Estado != 200: si es 429/cuota, burbuja exacta de descanso;
        // si no, aviso genérico de conexión. Nada rompe el chat.
        const msgCuota = error ? await extraerMensajeCuota(error) : null
        if (msgCuota) {
          console.warn('⚠️ Cuota de IA agotada, mostrando mensaje de descanso')
          responder(msgCuota, detectarPeligro(texto), 'sistema')
          return
        }
        avisarFallo(error?.message ?? data?.error ?? 'sin texto')
      })
      .catch((e) => {
        window.clearTimeout(esperaMax)
        avisarFallo(e instanceof Error ? e.message : 'red')
      })
  }

  // ── Ubicación exacta: autocompletado de destino ────────────────────────
  function abrirRuta() {
    setSugs([])
    setDestSel(null)
    // Precargar origen con el GPS actual, pero dejarlo editable
    setOrigen(dirActual ?? '')
    setOrigenSel(null)
    setSugsOrigen([])
    setBuscandoOrigen(false)
    setShowRuta(true)
    ;(async () => {
      try {
        const d = await direccionDesdeCoords(pos[1], pos[0])
        if (d) {
          setDirActual(d)
          // Solo autocompletar el campo si el usuario aún no escribió nada
          setOrigen((actual) => (actual.trim() ? actual : d))
        }
      } catch { /* sin red: se mantiene "Ubicación actual" */ }
    })()
  }

  function onDestinoChange(v: string) {
    setDestino(v)
    setDestSel(null)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    if (v.trim().length < 3) {
      setSugs([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    debounceRef.current = window.setTimeout(async () => {
      const ctl = new AbortController()
      abortRef.current = ctl
      try {
        setSugs(await buscarDirecciones(v, ctl.signal))
      } catch {
        if (!ctl.signal.aborted) setSugs([])
      } finally {
        if (!ctl.signal.aborted) setBuscando(false)
      }
    }, 400)
  }

  function elegirSug(s: ResultadoGeo) {
    setDestino(s.etiqueta)
    setDestSel(s)
    setSugs([])
    setBuscando(false)
  }

  // ── Origen editable: escribir la ubicación exacta ────────────────────
  function onOrigenChange(v: string) {
    setOrigen(v)
    setOrigenSel(null)
    if (debounceOrigenRef.current) window.clearTimeout(debounceOrigenRef.current)
    abortOrigenRef.current?.abort()
    if (v.trim().length < 3) {
      setSugsOrigen([])
      setBuscandoOrigen(false)
      return
    }
    setBuscandoOrigen(true)
    debounceOrigenRef.current = window.setTimeout(async () => {
      const ctl = new AbortController()
      abortOrigenRef.current = ctl
      try {
        setSugsOrigen(await buscarDirecciones(v, ctl.signal))
      } catch {
        if (!ctl.signal.aborted) setSugsOrigen([])
      } finally {
        if (!ctl.signal.aborted) setBuscandoOrigen(false)
      }
    }, 400)
  }

  function elegirOrigen(s: ResultadoGeo) {
    setOrigen(s.etiqueta)
    setOrigenSel(s)
    setSugsOrigen([])
    setBuscandoOrigen(false)
  }

  async function usarGpsComoOrigen() {
    abortOrigenRef.current?.abort()
    setSugsOrigen([])
    setBuscandoOrigen(false)
    setOrigenSel(null)
    try {
      const d = await direccionDesdeCoords(pos[1], pos[0])
      const etiqueta = d ?? 'Ubicación actual'
      setDirActual(etiqueta)
      setOrigen(etiqueta)
    } catch {
      setOrigen(dirActual ?? 'Ubicación actual')
    }
  }

  // Marcador del destino exacto + encuadre origen→destino
  const destKey = `${rutaActiva?.id ?? ''}:${rutaActiva?.destinoLat ?? ''},${rutaActiva?.destinoLng ?? ''}`
  useEffect(() => {
    destMarkerRef.current?.remove()
    destMarkerRef.current = null
    const map = mapObj.current
    if (!map || rutaActiva?.destinoLat == null || rutaActiva?.destinoLng == null) return
    try {
      const el = document.createElement('div')
      el.title = rutaActiva.destino
      el.style.cssText =
        'width:18px;height:18px;border-radius:9999px 9999px 9999px 0;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);transform:rotate(-45deg);'
      destMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([rutaActiva.destinoLng, rutaActiva.destinoLat])
        .addTo(map)
      const b = new maplibregl.LngLatBounds()
      b.extend([pos[0], pos[1]])
      b.extend([rutaActiva.destinoLng, rutaActiva.destinoLat])
      map.fitBounds(b, { padding: 60, duration: 600 })
    } catch { /* noop */ }
    return () => {
      destMarkerRef.current?.remove()
      destMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, estiloKey])

  const mapaListo = mapEstado === 'listo' && !!mapObj.current
  // Cualquier chip GPS visible desplaza hacia abajo pill, hint y preview.
  const hayChipGps = gpsEstado !== 'ok'

  function centrarme() {
    if (!mapObj.current) {
      setAviso('Mapa aún cargando — prueba Buscar destino manual.')
      return
    }
    try {
      mapObj.current.easeTo({ center: pos, zoom: 15, duration: 600 })
    } catch { /* noop */ }
  }

  function zoomIn() {
    if (!mapObj.current) return
    try { mapObj.current.zoomIn({ duration: 200 }) } catch { /* noop */ }
  }

  function zoomOut() {
    if (!mapObj.current) return
    try { mapObj.current.zoomOut({ duration: 200 }) } catch { /* noop */ }
  }

  const elapsedTxt = fmtDur(elapsed)
  const distanciaKm = infoRuta ? (infoRuta.distanciaM / 1000).toFixed(1) : null
  const etaHora =
    rutaActiva && infoRuta
      ? new Date(rutaActiva.inicioEpoch + infoRuta.duracionS * 1000).toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  return (
    <div
      className={`flex flex-col ${alertaActiva ? 'bg-[#FEF2F2]' : 'bg-canvas dark:bg-slate-950'}`}
      style={{ height: '100dvh' }}
    >
      {/* Único header sticky */}
      <DashboardHeader nombre={nombre} alertaActiva={alertaActiva} protegido={protegido} onSignOut={() => signOut()} />

      {/* Mapa protagonista: fondo de la pantalla.
          min-h-0 es obligatorio: sin él, el hijo flex con solo hijos
          absolutos puede colapsar y el canvas de MapLibre queda con
          altura 0 (franja delgada + resto blanco).
          Los estilos inline duplican lo crítico por si Tailwind no
          generara alguna clase: el layout no puede depender solo de CSS. */}
      <main
        className="relative flex-1 min-h-0 w-full overflow-hidden"
        style={{ flex: '1 1 0%', minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden', width: '100%' }}
      >
        <MapaSeguro
          mapRef={mapRef}
          mapEstado={mapEstado}
          gpsEstado={gpsEstado}
          detalle={mapDetalle}
          onReintentar={reintentarMapa}
          onBuscarManual={abrirRuta}
        />

        {/* ── Tab Inicio: elementos flotantes sobre el mapa ── */}
        {tab === 'inicio' && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {/* Barra de búsqueda flotante */}
            <button
              onClick={abrirRuta}
              className="pointer-events-auto absolute top-3 left-3 right-3 sm:left-4 sm:right-auto sm:w-[380px] flex items-center gap-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 border border-white dark:border-slate-700 text-left shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] transition-shadow"
              aria-label="Buscar destino"
            >
              <Search size={18} className="text-[#2563EB] shrink-0" />
              <span className="text-[15px] truncate text-[#94A3B8] dark:text-slate-500">
                {rutaActiva ? rutaActiva.destino : '¿A dónde vas?'}
              </span>
            </button>

            {gpsEstado === 'pendiente' && (
              <div className="pointer-events-auto absolute top-[68px] left-3 right-3 sm:left-4 sm:right-auto sm:max-w-[380px] flex items-center gap-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-line dark:border-slate-700 px-4 py-2.5 shadow-sm">
                <span className="w-4 h-4 rounded-full border-2 border-[#2563EB]/20 border-t-[#2563EB] animate-spin shrink-0" aria-hidden />
                <p className="text-[12px] font-medium text-muted dark:text-slate-400 leading-snug">
                  Localizando tu ubicación…{acc != null ? ` GPS ±${Math.round(acc)} m` : ''}
                </p>
              </div>
            )}

            {gpsEstado === 'denegado' && (
              <button
                onClick={reintentarGps}
                aria-label="Reintentar obtener mi ubicación"
                className="pointer-events-auto absolute top-[68px] left-3 right-3 sm:left-4 sm:right-auto sm:max-w-[380px] flex items-center gap-2 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] px-4 py-2.5 shadow-sm text-left"
              >
                <LocateFixed size={16} className="text-[#D97706] shrink-0" />
                <p className="text-[12px] font-medium text-[#92400E] leading-snug">
                  {permisoGps === 'denied'
                    ? 'Ubicación bloqueada en el navegador — actívala en el candado de la URL y toca para reintentar.'
                    : permisoGps === 'prompt'
                      ? 'Permiso de ubicación pendiente — toca para permitir tu ubicación.'
                      : 'GPS desactivado — ubicación aproximada. Toca para reintentar.'}
                </p>
              </button>
            )}

            {gpsEstado === 'error' && (
              <button
                onClick={reintentarGps}
                aria-label="Reintentar obtener mi ubicación"
                className="pointer-events-auto absolute top-[68px] left-3 right-3 sm:left-4 sm:right-auto sm:max-w-[380px] flex items-center gap-2 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-2.5 shadow-sm text-left"
              >
                <LocateFixed size={16} className="text-sos shrink-0" />
                <p className="text-[12px] font-medium text-sos leading-snug">
                  No pudimos obtener tu ubicación{gpsDetalle ? ` — ${gpsDetalle}` : ''} Toca para reintentar.
                </p>
              </button>
            )}

            {gpsEstado === 'sin-soporte' && (
              <div className="pointer-events-auto absolute top-[68px] left-3 right-3 sm:left-4 sm:right-auto sm:max-w-[380px] flex items-center gap-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-line dark:border-slate-700 px-4 py-2.5 shadow-sm">
                <LocateFixed size={16} className="text-muted dark:text-slate-400 shrink-0" />
                <p className="text-[12px] font-medium text-muted dark:text-slate-400 leading-snug">
                  {gpsDetalle ?? 'Este dispositivo no tiene GPS — ubicación aproximada.'}
                </p>
              </div>
            )}

            {/* Pill de contactos (mismo estilo que la search bar, bajo el toggle) */}
            <button
              onClick={() => setTab('red')}
              aria-label="Ver mi círculo de confianza"
              className={`pointer-events-auto absolute ${hayChipGps ? 'top-[168px]' : 'top-[120px]'} left-3 sm:left-4 inline-flex items-center gap-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-2.5 border border-white dark:border-slate-700 text-left shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] transition-shadow`}
            >
              <Users size={18} className="text-[#2563EB] shrink-0" />
              <span className="text-[14px] font-medium text-heading dark:text-white tabular-nums">
                {contactos.length} de 5 contactos
              </span>
            </button>

            {/* Opción A: toggle segmentado Explorar / Elegir destino.
                Ocupa la franja bajo el buscador; la pill de contactos y la
                card de preview se desplazan hacia abajo para no solaparse. */}
            {!rutaActiva && !preview && mapEstado === 'listo' && (
              <div
                role="tablist"
                aria-label="Modo del mapa"
                className={`pointer-events-auto absolute ${hayChipGps ? 'top-[116px]' : 'top-[68px]'} left-3 sm:left-4 inline-flex items-center gap-1 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-white dark:border-slate-700 p-1 shadow-[0_4px_20px_rgba(0,0,0,0.08)]`}
              >
                <button
                  role="tab"
                  aria-selected={modoMapa === 'explorar'}
                  onClick={() => setModoMapa('explorar')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    modoMapa === 'explorar'
                      ? 'bg-[#2563EB] text-white shadow-[0_2px_10px_rgba(37,99,235,0.45)]'
                      : 'text-muted dark:text-slate-400 hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:hover:bg-slate-800 dark:hover:text-[#93C5FD]'
                  }`}
                >
                  <Hand size={15} /> Explorar
                </button>
                <button
                  role="tab"
                  aria-selected={modoMapa === 'elegir'}
                  onClick={() => setModoMapa('elegir')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    modoMapa === 'elegir'
                      ? 'bg-[#2563EB] text-white shadow-[0_2px_10px_rgba(37,99,235,0.45)]'
                      : 'text-muted dark:text-slate-400 hover:bg-[#EFF6FF] hover:text-[#2563EB] dark:hover:bg-slate-800 dark:hover:text-[#93C5FD]'
                  }`}
                >
                  <MapPin size={15} /> Elegir destino
                </button>
              </div>
            )}

            {/* Card del destino seleccionado */}
            {!rutaActiva && preview && (
              <div className={`pointer-events-auto absolute ${hayChipGps ? 'top-[216px]' : 'top-[168px]'} left-3 right-3 sm:left-4 sm:right-auto sm:w-[380px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 border border-white dark:border-slate-700 shadow-[0_8px_28px_rgba(0,0,0,0.12)]`}>
                <div className="flex items-start gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-[#FEF2F2] text-sos flex items-center justify-center shrink-0">
                    <MapPin size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-faint dark:text-slate-500">
                      Destino seleccionado
                    </p>
                    <p className="text-[14px] font-semibold text-heading dark:text-white leading-snug">
                      {previewCargando ? 'Buscando dirección…' : preview.etiqueta}
                    </p>
                    {previewInfo && (
                      <p className="mt-0.5 text-[12px] text-muted dark:text-slate-400 tabular-nums">
                        {(previewInfo.distanciaM / 1000).toFixed(1)} km · ~
                        {Math.max(1, Math.round(previewInfo.duracionS / 60))} min en auto
                      </p>
                    )}
                  </div>
                  <button
                    onClick={limpiarPreview}
                    aria-label="Cancelar destino"
                    className="w-8 h-8 rounded-full hover:bg-canvas dark:hover:bg-slate-800 text-muted dark:text-slate-400 flex items-center justify-center transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
                <button
                  onClick={confirmarPreview}
                  disabled={previewCargando}
                  className="btn-primary w-full mt-2.5 py-2.5 text-[14px] disabled:opacity-50"
                >
                  <Navigation size={16} /> Iniciar ruta aquí
                </button>
              </div>
            )}

            {/* Controles del mapa flotantes (derecha; el toggle vive arriba a la izquierda) */}
            <div className="pointer-events-auto absolute right-3 bottom-64 flex flex-col rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-line dark:border-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
              <button
                onClick={zoomIn}
                disabled={!mapaListo}
                aria-label="Acercar"
                title={mapaListo ? 'Acercar' : 'Mapa cargando…'}
                className="w-10 h-10 flex items-center justify-center text-heading dark:text-white hover:bg-[#EFF6FF] dark:hover:bg-slate-800 hover:text-[#2563EB] dark:hover:text-[#93C5FD] transition-colors disabled:opacity-40"
              >
                <Plus size={18} />
              </button>
              <span className="h-px bg-line dark:bg-slate-700" aria-hidden />
              <button
                onClick={zoomOut}
                disabled={!mapaListo}
                aria-label="Alejar"
                title={mapaListo ? 'Alejar' : 'Mapa cargando…'}
                className="w-10 h-10 flex items-center justify-center text-heading dark:text-white hover:bg-[#EFF6FF] dark:hover:bg-slate-800 hover:text-[#2563EB] dark:hover:text-[#93C5FD] transition-colors disabled:opacity-40"
              >
                <Minus size={18} />
              </button>
              <span className="h-px bg-line dark:bg-slate-700" aria-hidden />
              <button
                onClick={centrarme}
                disabled={!mapaListo}
                aria-label="Centrar en mi ubicación"
                title={mapaListo ? 'Centrar en mi ubicación' : 'Mapa cargando…'}
                className="w-10 h-10 flex items-center justify-center text-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                <LocateFixed size={18} />
              </button>
            </div>

            {/* FAB Reportar: solo en exploración pura (sin ruta, previa ni selección) */}
            {!rutaActiva && !preview && !seleccionandoDestino && !selReporte && (
              <div className="pointer-events-auto absolute left-3 bottom-[232px] flex flex-col items-center gap-1">
                <button
                  onClick={() => setShowReporte(true)}
                  aria-label={`Reportar incidente en el mapa. Hay ${reportes.length} reportes visibles.`}
                  title="Reportar incidente"
                  className="relative w-12 h-12 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-white dark:border-slate-700 shadow-[0_8px_24px_rgba(220,38,38,0.25)] flex items-center justify-center text-[#DC2626] hover:scale-105 active:scale-95 transition-transform"
                >
                  <TriangleAlert size={22} />
                  {reportes.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                      {reportes.length}
                    </span>
                  )}
                </button>
                <span className="rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-white dark:border-slate-700 shadow px-2 py-0.5 text-[10px] font-bold text-heading dark:text-white">
                  Reportar
                </span>
              </div>
            )}

            {/* Pin central fijo (modo selección de destino o de reporte) */}
            {!rutaActiva && (seleccionandoDestino || selReporte) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                {/* halo */}
                <span className="absolute w-16 h-16 rounded-full bg-[#2563EB]/15 animate-ping" />
                <span className="relative flex flex-col items-center -translate-y-4">
                  <span
                    className="w-11 h-11 rounded-full rounded-br-none rotate-45 bg-[#2563EB] border-4 border-white dark:border-slate-700 shadow-[0_10px_28px_rgba(37,99,235,0.5)] flex items-center justify-center"
                  >
                    <MapPin size={20} className="text-white -rotate-45" />
                  </span>
                  <span className="mt-1 w-8 h-2 rounded-full bg-black/20 blur-[2px]" />
                </span>
              </div>
            )}

            {/* Fila inferior: SOS + acción central (se oculta en modos de selección) */}
            {!seleccionandoDestino && !selReporte && (
            <div className="pointer-events-auto absolute inset-x-3 bottom-4 mb-[88px] flex items-end gap-3">
              {/* Card flotante de emergencia */}
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-line dark:border-slate-700 px-2.5 py-2.5 shadow-[0_8px_28px_rgba(220,38,38,0.18)] shrink-0">
                <span className="relative flex items-center justify-center">
                  <span className="sos-ring absolute w-[72px] h-[72px] rounded-full bg-[#DC2626]/25" style={{ animationDuration: '2.5s' }} aria-hidden />
                  <span className="sos-ring absolute w-[72px] h-[72px] rounded-full bg-[#DC2626]/20" style={{ animationDuration: '2.5s', animationDelay: '0.8s' }} aria-hidden />
                  <button
                    onClick={activarSOS}
                    aria-label="Botón de pánico SOS. Un solo toque, sin confirmación."
                    className="relative w-[72px] h-[72px] rounded-full bg-sos text-white border-[3px] border-white/70 shadow-[0_8px_24px_rgba(220,38,38,0.45)] flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  >
                    <span className="text-[19px] font-bold leading-none tracking-widest">SOS</span>
                  </button>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sos">
                  Emergencia
                </span>
              </div>

              {/* Centro inferior: iniciar o ruta activa */}
              <div className="flex-1 min-w-0 flex justify-center">
                {!rutaActiva ? (
                  <button
                    onClick={abrirRuta}
                    className="btn-primary w-full max-w-[340px] py-3.5 text-[15px] !rounded-2xl"
                  >
                    <Play size={18} /> Iniciar Ruta Segura
                  </button>
                ) : (
                  <div className="w-full max-w-[420px] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-line dark:border-slate-700 shadow-[0_8px_28px_rgba(37,99,235,0.18)] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#059669]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                        Operador conectado
                      </span>
                      <button
                        onClick={activarSOS}
                        aria-label="Botón de pánico SOS. Un solo toque, sin confirmación."
                        className="w-9 h-9 rounded-full bg-sos text-white text-[11px] font-bold border-2 border-white dark:border-slate-700 shadow-[0_4px_12px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95 transition-transform shrink-0"
                      >
                        SOS
                      </button>
                    </div>
                    <p className="mt-1.5 text-[14px] font-bold text-heading dark:text-white leading-snug">
                      Tu viaje está siendo monitoreado
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted dark:text-slate-400 tabular-nums flex items-center gap-1.5">
                      <Clock3 size={13} className="text-[#2563EB]" />
                      {elapsedTxt}
                      {distanciaKm && <span>· {distanciaKm} km</span>}
                      {etaHora && <span>· llegada ~{etaHora}</span>}
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => setShowChat(true)}
                        className="btn-primary flex-1 py-2.5 text-[13px]"
                      >
                        <MessageCircle size={16} /> Hablar con operador
                      </button>
                      <button
                        onClick={terminarRuta}
                        className="px-3 py-2.5 rounded-[10px] text-[13px] font-semibold text-muted dark:text-slate-400 hover:bg-canvas transition-colors shrink-0"
                      >
                        Finalizar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Barra del modo "ubicar reporte": confirmar vuelve al modal con las coords */}
            {!rutaActiva && selReporte && (
              <div className="pointer-events-auto absolute inset-x-3 bottom-4 mb-[88px] mx-auto max-w-[420px] rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-white dark:border-slate-700 shadow-lg p-3">
                <p className="text-center text-[12px] font-medium text-muted dark:text-slate-400 leading-snug">
                  Arrastra el mapa para ubicar el reporte bajo el pin
                </p>
                {centroRep && (
                  <p className="mt-0.5 text-center text-[11px] text-faint dark:text-slate-500 tabular-nums">
                    {centroRep.lat.toFixed(5)}, {centroRep.lng.toFixed(5)}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={cancelarSelectorReporte}
                    className="btn-secondary flex-1 py-3 text-[14px]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarUbicacionReporte}
                    disabled={!centroRep && !mapObj.current}
                    className="btn-primary flex-[2] py-3 text-[14px] !bg-sos hover:!bg-[#B91C1C] disabled:opacity-50"
                  >
                    <MapPin size={16} />
                    Confirmar ubicación
                  </button>
                </div>
              </div>
            )}

            {/* Banner sutil + acciones del modo selección (abajo, no tapa el zoom) */}
            {!rutaActiva && seleccionandoDestino && (
              <div className="pointer-events-auto absolute inset-x-3 bottom-4 mb-[88px] mx-auto max-w-[420px] rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-white dark:border-slate-700 shadow-lg p-3">
                <p className="text-center text-[12px] font-medium text-muted dark:text-slate-400 leading-snug">
                  Arrastra el mapa para fijar tu destino bajo el pin
                </p>
                {centroMapa && (
                  <p className="mt-0.5 text-center text-[11px] text-faint dark:text-slate-500 tabular-nums">
                    {centroMapa.lat.toFixed(5)}, {centroMapa.lng.toFixed(5)}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setModoMapa('explorar')}
                    className="btn-secondary flex-1 py-3 text-[14px]"
                  >
                    Cancelar
                  </button>
                  {centroMovido && (
                    <button
                      onClick={confirmarCentro}
                      disabled={!centroMapa || previewCargando}
                      className="btn-primary flex-[2] py-3 text-[14px] disabled:opacity-50"
                    >
                      <Navigation size={16} />
                      {previewCargando ? 'Buscando…' : 'Confirmar Destino'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tabs Red / Actividad / Perfil: sheets sobre el mapa ── */}
        {tab !== 'inicio' && (
          <div className="absolute inset-0 z-10 bg-canvas dark:bg-slate-950 overflow-y-auto">
            <div className="p-4 pb-6 max-w-lg mx-auto flex flex-col gap-4">
              {tab === 'red' && (
                <CirculoLista
                  contactos={contactos}
                  onAgregar={() => setShowContacto(true)}
                  onCompartir={compartirUbicacion}
                  onEliminar={eliminarContacto}
                />
              )}
              {tab === 'actividad' && <HistorialLista historial={historial} />}
              {tab === 'perfil' && (
                <>
                  <section className="card p-5 flex items-center gap-4">
                    <span className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white text-[22px] font-bold flex items-center justify-center shrink-0">
                      {nombre.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[17px] font-bold text-heading dark:text-white truncate">{nombre}</p>
                      <p className="text-[13px] text-muted dark:text-slate-400 truncate">{user?.email}</p>
                      <span
                        className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          alertaActiva ? 'bg-[#FEF2F2] text-sos' : 'bg-[#ECFDF5] text-[#059669]'
                        }`}
                      >
                        <Crosshair size={12} />
                        {alertaActiva ? 'Alerta activa' : protegido ? 'Protegido' : 'Inactivo'}
                      </span>
                    </div>
                  </section>
                  <StatsRuta elapsed={elapsedTxt} conRuta={!!rutaActiva} acc={acc} nContactos={contactos.length} />
                  <button
                    onClick={() => signOut()}
                    className="btn-secondary w-full py-3 text-[14px]"
                  >
                    Cerrar sesión
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Chat: operador con nombre en ruta (acompañamiento), genérico en el resto */}
        <ChatOperador
          abierto={showChat}
          mensajes={mensajes}
          onToggle={() => setShowChat((v) => !v)}
          onEnviar={enviarChat}
          fab={false}
          modo={rutaActiva && !alertaActiva ? 'acompanamiento' : 'operador'}
          nombreOperador={OPERADOR_NOMBRE}
          fotoOperador={FOTO_OPERADOR}
          escribiendo={operadorEscribiendo}
          onSolicitarLlamada={() => setAviso('La llamada simulada llega en el siguiente paso 📞')}
          onActivarSOS={activarSOS}
          sesionFinalizada={sesionFinalizada}
          onIniciarNuevaRuta={() => {
            setShowChat(false)
            abrirRuta()
          }}
        />
      </main>

      {/* Navbar inferior fija */}
      <BottomNav tab={tab} onTab={setTab} />

      {showRuta && (
        <ModalRuta
          dirActual={dirActual}
          pos={pos}
          acc={acc}
          origen={origen}
          origenSel={origenSel}
          sugsOrigen={sugsOrigen}
          buscandoOrigen={buscandoOrigen}
          destino={destino}
          sugs={sugs}
          buscando={buscando}
          destSel={destSel}
          onOrigenChange={onOrigenChange}
          onElegirOrigen={elegirOrigen}
          onUsarGps={usarGpsComoOrigen}
          onDestinoChange={onDestinoChange}
          onElegir={elegirSug}
          onCerrar={() => setShowRuta(false)}
          onConfirmar={confirmarRuta}
        />
      )}

      {showContacto && (
        <ModalContacto
          form={formC}
          onForm={(patch) => setFormC((f) => ({ ...f, ...patch }))}
          onCerrar={() => setShowContacto(false)}
          onGuardar={agregarContacto}
        />
      )}

      {showReporte && (
        <ModalReporte
          form={formRep}
          onForm={(patch) => setFormRep((f) => ({ ...f, ...patch }))}
          coordsTxt={
            reportLoc
              ? `${reportLoc.lat.toFixed(5)}, ${reportLoc.lng.toFixed(5)} · elegida en mapa`
              : `${pos[1].toFixed(5)}, ${pos[0].toFixed(5)} · tu GPS`
          }
          ubicacionElegida={reportLoc != null}
          guardando={repGuardando}
          onSeleccionarUbicacion={abrirSelectorReporte}
          onCerrar={() => setShowReporte(false)}
          onGuardar={enviarReporte}
        />
      )}

      {showSosModal && <ModalSOS onEntendido={() => setShowSosModal(false)} onCancelar={() => { setAlerta(false); setShowSosModal(false) }} />}

      {aviso && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-heading text-white rounded-full px-5 py-2.5 text-[13px] shadow-lg flex items-center gap-2 whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-hidden">
          <CheckCircle2 size={16} className="shrink-0" /> <span className="truncate">{aviso}</span>
        </div>
      )}
    </div>
  )
}
