import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// Vite empaqueta el worker como asset aparte: hay que indicarle la URL.
// Sin esto el mapa falla con "Worker failed to load" y nunca dispara 'load'.
maplibregl.config.WORKER_URL = mapWorkerUrl
import {
  CheckCircle2, Clock3, Crosshair, LocateFixed, MapPin, MessageCircle,
  Minus, Moon, Navigation, Plus, Search, Sun, Users, X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { buscarDirecciones, direccionDesdeCoords, type ResultadoGeo } from '../lib/geocoding'
import { obtenerRutaCalles } from '../lib/rutaOSRM'
import Supercluster from 'supercluster'
import { useSeguridad, type Contacto } from '../store/usoSeguridad'
import DashboardHeader from '../components/usuario/DashboardHeader'
import MapaSeguro, { type GpsEstado, type MapEstado } from '../components/usuario/MapaSeguro'
import { useSearchParams } from 'react-router-dom'
import BottomNav, { type TabId } from '../components/usuario/BottomNav'
import StatsRuta from '../components/usuario/StatsRuta'
import CirculoLista from '../components/usuario/CirculoLista'
import HistorialLista from '../components/usuario/HistorialLista'
import ChatConOperador from '../components/usuario/ChatConOperador'
import { useChatAcompanamiento } from '../hooks/useChatAcompanamiento'
import BuscandoOperador from '../components/usuario/BuscandoOperador'
import BotonSOS from '../components/usuario/BotonSOS'
import BotonIniciarRuta from '../components/usuario/BotonIniciarRuta'
import BotonReportar from '../components/usuario/BotonReportar'
import { useAcompanamiento } from '../hooks/useAcompanamiento'
import { useSOS } from '../hooks/useSOS'
import type { Acompanamiento } from '../lib/acompanamientos'
import { ModalRuta, ModalContacto, ModalSOS, ModalReporte, type EstadoModalSOS, type FormContacto, type FormReporte } from '../components/usuario/Modales'

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

/** Ruta a la espera de operador; se activa en el mapa cuando el acompañamiento pasa a EN_CURSO. */
interface RutaPendiente {
  id: string
  origen: string
  destino: string
  origenLng: number | null
  origenLat: number | null
  destinoLat: number | null
  destinoLng: number | null
}

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
  const { esOscuro, toggleTheme } = useTheme()
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
    rutaActiva, alertaActiva, contactos, historial,
    iniciarRuta, finalizarRuta, setAlerta, setContactos, setHistorial,
  } = useSeguridad()

  const [nombre, setNombre] = useState<string>(user?.email ?? 'Usuario')
  // ?tab=perfil permite abrir una pestaña directo (p. ej. desde el menú del header).
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabId>(() => (searchParams.get('tab') === 'perfil' ? 'perfil' : 'inicio'))
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

  // Acompañamiento en vivo con un operador (Realtime). Al operador solo se
  // le envía GPS real: con el fallback de Santiago no se manda nada.
  const gpsRealRef = useRef<[number, number] | null>(null)
  gpsRealRef.current = gpsEstado === 'ok' ? pos : null
  const {
    acomp,
    solicitar: solicitarAcomp,
    cancelar: cancelarAcomp,
    finalizar: finalizarAcomp,
    limpiar: limpiarAcomp,
  } = useAcompanamiento(user?.id, () => gpsRealRef.current)
  const [cancelandoAcomp, setCancelandoAcomp] = useState(false)
  // Entre confirmar la ruta y que exista la solicitud: el botón muestra "Buscando operador…".
  const [solicitandoRuta, setSolicitandoRuta] = useState(false)
  // SOS real (tabla alertas + Realtime): mismo GPS real que el acompañamiento.
  const sos = useSOS(user?.id, () => gpsRealRef.current)
  const [sosError, setSosError] = useState(false)
  const [cancelandoSos, setCancelandoSos] = useState(false)
  // Chat real con el operador de la central (tabla mensajes + Realtime).
  const chat = useChatAcompanamiento(acomp?.id ?? null, 'usuario')
  // Mensajes del operador ya vistos (se marca al abrir/cerrar el chat).
  const [vistosOperador, setVistosOperador] = useState<{ acompId: string | null; n: number }>({ acompId: null, n: 0 })
  const mensajesOperador = chat.mensajes.filter((m) => m.emisor_rol === 'operador').length
  const noLeidos =
    showChat || !acomp ? 0 : mensajesOperador - (vistosOperador.acompId === acomp.id ? vistosOperador.n : 0)
  function abrirChat(abrir: boolean) {
    setShowChat(abrir)
    setVistosOperador({ acompId: acomp?.id ?? null, n: mensajesOperador })
  }
  // Datos de la ruta recién solicitada (coords exactas) hasta que un operador la acepta.
  const rutaPendienteRef = useRef<RutaPendiente | null>(null)
  // Acompañamiento visto en PENDIENTE en esta pestaña: al conectarse, el operador saluda.
  // (Si se retoma uno ya EN_CURSO tras recargar, no se repite el saludo.)
  const pendienteVistoRef = useRef<string | null>(null)

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
        // Zoom y "centrar" son botones propios (columna derecha); los controles
        // nativos de MapLibre los duplicaban y quedaban bajo la tarjeta inferior.
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
    setShowSosModal(true)
    setSosError(false)
    // Ya hay una abierta: solo volver a mostrar su estado.
    if (sos.abierta) return
    const error = await sos.activar()
    if (error) setSosError(true)
  }

  async function cancelarSOS() {
    setCancelandoSos(true)
    const error = await sos.cancelar()
    setCancelandoSos(false)
    if (error) {
      setAviso(error)
      return
    }
    setShowSosModal(false)
    setAviso('Alerta SOS cancelada.')
  }

  // El header ("Alerta activa") sigue al SOS real, no a un flag local.
  useEffect(() => {
    setAlerta(sos.abierta)
  }, [sos.abierta, setAlerta])

  // Al retomar un SOS abierto (recarga) se vuelve a mostrar su estado.
  const sosMostradoRef = useRef<string | null>(null)
  useEffect(() => {
    if (!sos.alerta || !sos.abierta || sosMostradoRef.current === sos.alerta.id) return
    sosMostradoRef.current = sos.alerta.id
    setShowSosModal(true)
  }, [sos.alerta, sos.abierta])

  // La central cerró la alerta: avisar y volver al estado normal.
  const estadoSos = sos.alerta?.estado
  const limpiarSos = sos.limpiar
  useEffect(() => {
    if (estadoSos !== 'resuelta' && estadoSos !== 'descartada' && estadoSos !== 'cancelada') return
    setShowSosModal(false)
    setAviso(estadoSos === 'resuelta' ? 'La central cerró tu alerta SOS.' : 'Tu alerta SOS fue cerrada.')
    limpiarSos()
  }, [estadoSos, limpiarSos])

  const estadoModalSos: EstadoModalSOS = sosError
    ? 'error'
    : sos.enviando || !sos.alerta
      ? 'enviando'
      : sos.alerta.estado === 'en_atencion'
        ? 'en_atencion'
        : 'activa'

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
    if (acomp) {
      setAviso('Ya tienes una ruta segura en curso.')
      return
    }
    setSolicitandoRuta(true)
    try {
      await solicitarRutaSegura(destinoTxt, destCoords, origenTxtOverride, origenCoordsOverride)
    } finally {
      setSolicitandoRuta(false)
    }
  }

  async function solicitarRutaSegura(
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
    let rutaGuardada = false
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
      if (!error && data?.id) {
        id = data.id
        rutaGuardada = true
      }
    } catch { /* tolerante */ }

    // La ruta queda en espera ("Buscando operador…") hasta que un operador
    // acepta el acompañamiento; recién ahí se activa en el mapa.
    rutaPendienteRef.current = {
      id,
      origen: origenTxt,
      destino: destinoTxt,
      origenLng: oLng,
      origenLat: oLat,
      destinoLat: destCoords?.lat ?? null,
      destinoLng: destCoords?.lng ?? null,
    }
    const gps = gpsRealRef.current
    const error = await solicitarAcomp({
      origen: origenTxt,
      destino: destinoTxt,
      rutaId: rutaGuardada ? id : null,
      lat: gps ? gps[1] : null,
      lng: gps ? gps[0] : null,
      origenLat: oLat,
      origenLng: oLng,
      destinoLat: destCoords?.lat ?? null,
      destinoLng: destCoords?.lng ?? null,
    })
    if (error) {
      rutaPendienteRef.current = null
      if (rutaGuardada) {
        void supabase.from('rutas').update({ fin: new Date().toISOString(), estado: 'cancelada' }).eq('id', id)
      }
      setAviso(error)
    }
  }

  /** Datos de la ruta de un acompañamiento retomado (p. ej. tras recargar la página). */
  async function rutaDesdeAcompanamiento(a: Acompanamiento): Promise<RutaPendiente> {
    const base: RutaPendiente = {
      id: a.ruta_id ?? a.id,
      origen: a.origen,
      destino: a.destino,
      origenLng: a.lng_actual,
      origenLat: a.lat_actual,
      destinoLat: null,
      destinoLng: null,
    }
    if (!a.ruta_id) return base
    const { data } = await supabase
      .from('rutas')
      .select('origen_lat, origen_lng, destino_lat, destino_lng')
      .eq('id', a.ruta_id)
      .maybeSingle()
    if (!data) return base
    return {
      ...base,
      origenLat: data.origen_lat ?? base.origenLat,
      origenLng: data.origen_lng ?? base.origenLng,
      destinoLat: data.destino_lat,
      destinoLng: data.destino_lng,
    }
  }

  /** Un operador aceptó: la ruta se activa en el mapa y (si es una conexión nueva) el operador saluda. */
  function conectarRuta(r: RutaPendiente, saludar: boolean) {
    iniciarRuta({
      id: r.id,
      origen: r.origen,
      destino: r.destino,
      inicioEpoch: Date.now(),
      destinoLat: r.destinoLat ?? undefined,
      destinoLng: r.destinoLng ?? undefined,
    })
    // Ruta real por calles (no bloquea la activación)
    if (r.destinoLat != null && r.destinoLng != null && r.origenLat != null && r.origenLng != null) {
      const o: [number, number] = [r.origenLng, r.origenLat]
      const d: [number, number] = [r.destinoLng, r.destinoLat]
      obtenerRutaCalles(o, d).then((ruta) => {
        if (ruta) {
          setLineaRuta(ruta.coords)
          setInfoRuta({ distanciaM: ruta.distanciaM, duracionS: ruta.duracionS })
        } else {
          setLineaRuta([o, d])
          setInfoRuta(null)
        }
      })
    } else {
      setLineaRuta(null)
      setInfoRuta(null)
    }
    if (saludar) setAviso('Operador conectado. Tu ruta está siendo monitoreada.')
  }

  // Reacciona a los cambios del acompañamiento que llegan por Realtime.
  useEffect(() => {
    if (!acomp) return
    if (acomp.estado === 'PENDIENTE') {
      pendienteVistoRef.current = acomp.id
      return
    }
    if (acomp.estado === 'EN_CURSO') {
      if (useSeguridad.getState().rutaActiva) return
      const saludar = pendienteVistoRef.current === acomp.id
      const pendiente = rutaPendienteRef.current
      rutaPendienteRef.current = null
      if (pendiente) conectarRuta(pendiente, saludar)
      else void rutaDesdeAcompanamiento(acomp).then((r) => conectarRuta(r, saludar))
      return
    }
    // FINALIZADO por el operador (el usuario limpia el suyo antes de enviarlo),
    // DESCARTADA por la central, o CANCELADO.
    limpiarAcomp()
    rutaPendienteRef.current = null
    const enRuta = !!useSeguridad.getState().rutaActiva
    if (acomp.estado === 'FINALIZADO' && enRuta) {
      void cerrarRuta('Tu operador finalizó el acompañamiento. ¡Llegaste bien!')
    } else if (acomp.estado === 'DESCARTADA') {
      if (enRuta) {
        void cerrarRuta('La central cerró tu acompañamiento.')
      } else {
        if (acomp.ruta_id) {
          void supabase.from('rutas').update({ fin: new Date().toISOString(), estado: 'cancelada' }).eq('id', acomp.ruta_id)
        }
        setAviso('La central no pudo tomar tu solicitud. Intenta de nuevo o usa el SOS si es urgente.')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acomp?.id, acomp?.estado])

  async function cancelarSolicitud() {
    if (!acomp || acomp.estado !== 'PENDIENTE') return
    const rutaId = acomp.ruta_id
    setCancelandoAcomp(true)
    const cancelada = await cancelarAcomp()
    setCancelandoAcomp(false)
    // false: un operador la aceptó justo antes; el efecto de arriba la conecta.
    if (!cancelada) return
    rutaPendienteRef.current = null
    if (rutaId) {
      void supabase.from('rutas').update({ fin: new Date().toISOString(), estado: 'cancelada' }).eq('id', rutaId)
    }
    setAviso('Solicitud cancelada.')
  }

  async function confirmarRuta() {
    if (!destino.trim() || !user) return
    const origenTxt = origen.trim() || dirActual || 'Ubicación actual'
    const origenCoords = origenSel ? { lat: origenSel.lat, lng: origenSel.lng } : null
    const destinoTxt = destino.trim()
    const destCoords = destSel ? { lat: destSel.lat, lng: destSel.lng } : null
    // Se cierra primero: el usuario ve el botón pasar a "Buscando operador…".
    setShowRuta(false)
    setDestino('')
    setDestSel(null)
    setSugs([])
    await activarRuta(destinoTxt, destCoords, origenTxt, origenCoords)
  }

  async function confirmarPreview() {
    if (!preview || previewCargando || !user) return
    await activarRuta(preview.etiqueta, { lat: preview.lat, lng: preview.lng })
    limpiarPreview()
  }

  async function terminarRuta() {
    if (!rutaActiva || !user) return
    void finalizarAcomp()
    await cerrarRuta('Ruta finalizada. ¡Bien hecho!')
  }

  /** Cierre local de la ruta (la termine el usuario o su operador). */
  async function cerrarRuta(avisoTxt: string) {
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
    finalizarRuta()
    setLineaRuta(null)
    setInfoRuta(null)
    setShowChat(false)
    setAviso(avisoTxt)
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
      <DashboardHeader alertaActiva={alertaActiva} protegido={protegido} />

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

        {/* ── Tab Inicio: elementos flotantes sobre el mapa ──
            Dos columnas flex (arriba y abajo) en vez de coordenadas fijas: cada
            elemento se apila según su alto real y nada queda tapado. */}
        {tab === 'inicio' && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {/* ── Zona superior: búsqueda + contactos, avisos GPS, destino, reportar ── */}
            <div className="absolute inset-x-0 top-0 p-3 flex flex-col items-stretch sm:items-start gap-2">
              <div className="pointer-events-auto sm:w-[400px] flex items-center gap-1 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
                <button
                  onClick={abrirRuta}
                  className="flex-1 min-w-0 h-11 flex items-center gap-2.5 rounded-xl px-3 text-left hover:bg-white/5 transition-colors"
                  aria-label="Buscar destino"
                >
                  <Search size={18} className="text-[#60A5FA] shrink-0" />
                  <span className={`text-[15px] truncate ${rutaActiva ? 'text-white' : 'text-slate-400'}`}>
                    {rutaActiva ? rutaActiva.destino : '¿A dónde vas?'}
                  </span>
                </button>
                <span className="w-px h-6 bg-white/10" aria-hidden />
                <button
                  onClick={() => setTab('red')}
                  aria-label={`Ver mi círculo de confianza: ${contactos.length} de 5 contactos`}
                  title="Mi círculo de confianza"
                  className="relative w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                >
                  <Users size={19} />
                  <span className="absolute bottom-0.5 right-0 rounded-full bg-blue-600 px-1 text-[9px] font-bold leading-[14px] text-white tabular-nums ring-2 ring-slate-900">
                    {contactos.length}/5
                  </span>
                </button>
              </div>

              {gpsEstado === 'pendiente' && (
                <div className="pointer-events-auto sm:max-w-[400px] flex items-center gap-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 px-4 py-2.5">
                  <span className="w-4 h-4 rounded-full border-2 border-[#60A5FA]/25 border-t-[#60A5FA] animate-spin shrink-0" aria-hidden />
                  <p className="text-[12px] font-medium text-slate-300 leading-snug">
                    Localizando tu ubicación…{acc != null ? ` GPS ±${Math.round(acc)} m` : ''}
                  </p>
                </div>
              )}

              {gpsEstado === 'denegado' && (
                <button
                  onClick={reintentarGps}
                  aria-label="Reintentar obtener mi ubicación"
                  className="pointer-events-auto sm:max-w-[400px] flex items-center gap-2 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] px-4 py-2.5 shadow-sm text-left"
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
                  className="pointer-events-auto sm:max-w-[400px] flex items-center gap-2 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-2.5 shadow-sm text-left"
                >
                  <LocateFixed size={16} className="text-sos shrink-0" />
                  <p className="text-[12px] font-medium text-sos leading-snug">
                    No pudimos obtener tu ubicación{gpsDetalle ? ` — ${gpsDetalle}` : ''} Toca para reintentar.
                  </p>
                </button>
              )}

              {gpsEstado === 'sin-soporte' && (
                <div className="pointer-events-auto sm:max-w-[400px] flex items-center gap-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 px-4 py-2.5">
                  <LocateFixed size={16} className="text-slate-400 shrink-0" />
                  <p className="text-[12px] font-medium text-slate-300 leading-snug">
                    {gpsDetalle ?? 'Este dispositivo no tiene GPS — ubicación aproximada.'}
                  </p>
                </div>
              )}

              {/* Card del destino elegido en el mapa */}
              {!rutaActiva && preview && (
                <div className="pointer-events-auto sm:w-[400px] rounded-2xl bg-slate-900/90 backdrop-blur-xl px-4 py-3 border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
                  <div className="flex items-start gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
                      <MapPin size={18} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        Destino seleccionado
                      </p>
                      <p className="text-[14px] font-semibold text-white leading-snug">
                        {previewCargando ? 'Buscando dirección…' : preview.etiqueta}
                      </p>
                      {previewInfo && (
                        <p className="mt-0.5 text-[12px] text-slate-400 tabular-nums">
                          {(previewInfo.distanciaM / 1000).toFixed(1)} km · ~
                          {Math.max(1, Math.round(previewInfo.duracionS / 60))} min en auto
                        </p>
                      )}
                    </div>
                    <button
                      onClick={limpiarPreview}
                      aria-label="Cancelar destino"
                      className="w-11 h-11 -mr-2 -mt-1.5 rounded-full hover:bg-white/10 text-slate-400 flex items-center justify-center transition-colors shrink-0"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <button
                    onClick={confirmarPreview}
                    disabled={previewCargando}
                    className="w-full mt-2.5 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    <Navigation size={16} /> Iniciar ruta aquí
                  </button>
                </div>
              )}

              {/* Reportar: arriba a la derecha, lejos de la zona del pulgar y del SOS */}
              {!rutaActiva && !preview && !seleccionandoDestino && !selReporte && (
                <div className="pointer-events-auto self-end">
                  <BotonReportar onClick={() => setShowReporte(true)} cantidad={reportes.length} />
                </div>
              )}
            </div>

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

            {/* ── Zona inferior (pulgar): controles del mapa + una sola barra de acción.
                El mapa termina donde empieza la navbar, así que basta un margen de 16 px. ── */}
            <div className="absolute inset-x-0 bottom-0 px-4 pb-4 flex flex-col items-stretch gap-3">
              {/* Controles del mapa: siempre por encima de la barra, nunca tapados */}
              <div className="pointer-events-auto self-end flex flex-col rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-[0_6px_24px_rgba(0,0,0,0.35)] overflow-hidden">
                <button
                  onClick={zoomIn}
                  disabled={!mapaListo}
                  aria-label="Acercar"
                  title={mapaListo ? 'Acercar' : 'Mapa cargando…'}
                  className="w-11 h-11 flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-40"
                >
                  <Plus size={18} />
                </button>
                <span className="h-px bg-white/10" aria-hidden />
                <button
                  onClick={zoomOut}
                  disabled={!mapaListo}
                  aria-label="Alejar"
                  title={mapaListo ? 'Alejar' : 'Mapa cargando…'}
                  className="w-11 h-11 flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-40"
                >
                  <Minus size={18} />
                </button>
                <span className="h-px bg-white/10" aria-hidden />
                <button
                  onClick={centrarme}
                  disabled={!mapaListo}
                  aria-label="Centrar en mi ubicación"
                  title={mapaListo ? 'Centrar en mi ubicación' : 'Mapa cargando…'}
                  className="w-11 h-11 flex items-center justify-center text-[#60A5FA] hover:bg-white/10 active:bg-white/20 transition-colors disabled:opacity-40"
                >
                  <LocateFixed size={18} />
                </button>
              </div>

              {/* Modo "ubicar reporte": confirmar vuelve al modal con las coords */}
              {!rutaActiva && selReporte ? (
                <div className="pointer-events-auto w-full max-w-[440px] mx-auto rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-3">
                  <p className="text-center text-[13px] font-medium text-slate-300 leading-snug">
                    Arrastra el mapa para ubicar el reporte bajo el pin
                  </p>
                  {centroRep && (
                    <p className="mt-0.5 text-center text-[11px] text-slate-500 tabular-nums">
                      {centroRep.lat.toFixed(5)}, {centroRep.lng.toFixed(5)}
                    </p>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={cancelarSelectorReporte}
                      className="flex-1 h-12 rounded-xl border border-white/15 text-[14px] font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarUbicacionReporte}
                      disabled={!centroRep && !mapObj.current}
                      className="flex-[2] h-12 rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-slate-950 text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      <MapPin size={16} />
                      Confirmar ubicación
                    </button>
                  </div>
                </div>
              ) : !rutaActiva && seleccionandoDestino ? (
                /* Modo "elegir destino en el mapa" (se entra desde el modal de ruta) */
                <div className="pointer-events-auto w-full max-w-[440px] mx-auto rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-3">
                  <p className="text-center text-[13px] font-medium text-slate-300 leading-snug">
                    Arrastra el mapa para fijar tu destino bajo el pin
                  </p>
                  {centroMapa && (
                    <p className="mt-0.5 text-center text-[11px] text-slate-500 tabular-nums">
                      {centroMapa.lat.toFixed(5)}, {centroMapa.lng.toFixed(5)}
                    </p>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={cancelarSeleccion}
                      className="flex-1 h-12 rounded-xl border border-white/15 text-[14px] font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                    >
                      Cancelar
                    </button>
                    {centroMovido && (
                      <button
                        onClick={confirmarCentro}
                        disabled={!centroMapa || previewCargando}
                        className="flex-[2] h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                      >
                        <Navigation size={16} />
                        {previewCargando ? 'Buscando…' : 'Confirmar Destino'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Solicitud enviada: detalles y acciones, encima de la barra */}
                  {acomp?.estado === 'PENDIENTE' && (
                    <div className="pointer-events-auto">
                      <BuscandoOperador
                        destino={acomp.destino}
                        cancelando={cancelandoAcomp}
                        onCancelar={cancelarSolicitud}
                        onChat={() => abrirChat(true)}
                      />
                    </div>
                  )}

                  {/* Barra flotante única: Ruta (izquierda) + SOS (derecha, pulgar) */}
                  <div className="pointer-events-auto w-full max-w-[440px] mx-auto rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    {!rutaActiva ? (
                      <div className="flex items-center gap-2 p-2 pl-3">
                        <div className="flex-1 min-w-0">
                          <BotonIniciarRuta
                            onClick={abrirRuta}
                            buscando={solicitandoRuta || acomp?.estado === 'PENDIENTE'}
                          />
                        </div>
                        <BotonSOS abierta={sos.abierta} onActivar={() => void activarSOS()} />
                      </div>
                    ) : (
                      <div className="p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#10B981] animate-pulse" />
                            <span className="truncate">Operador conectado</span>
                          </span>
                          <BotonSOS size="sm" abierta={sos.abierta} onActivar={() => void activarSOS()} />
                        </div>
                        <p className="mt-1 text-[15px] font-bold text-white leading-snug">
                          Tu viaje está siendo monitoreado
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-snug text-slate-400 tabular-nums">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Clock3 size={13} className="text-[#60A5FA]" />
                            {elapsedTxt}
                          </span>
                          {distanciaKm && <span className="whitespace-nowrap">· {distanciaKm} km</span>}
                          {etaHora && <span className="whitespace-nowrap">· llegada ~{etaHora}</span>}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => abrirChat(true)}
                            className="relative flex-[7] min-w-0 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[14px] font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                          >
                            <MessageCircle size={16} /> Hablar con operador
                            {noLeidos > 0 && (
                              <span
                                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-sos text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-slate-900"
                                aria-label={`${noLeidos} mensajes sin leer`}
                              >
                                {noLeidos}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={terminarRuta}
                            className="flex-[3] min-w-0 h-12 rounded-xl border border-white/15 px-2 text-[14px] font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                          >
                            Finalizar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
                  {/* Tema y cerrar sesión: fuera del header para despejarlo */}
                  <button
                    onClick={toggleTheme}
                    aria-pressed={esOscuro}
                    className="card w-full p-4 flex items-center gap-3 text-left hover:bg-canvas dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-[#93C5FD] flex items-center justify-center shrink-0">
                      {esOscuro ? <Sun size={19} /> : <Moon size={19} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-heading dark:text-white">Modo oscuro</span>
                      <span className="block text-[12px] text-muted dark:text-slate-400">
                        {esOscuro ? 'Activado' : 'Desactivado'}
                      </span>
                    </span>
                    <span
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${esOscuro ? 'bg-brand-600' : 'bg-line dark:bg-slate-700'}`}
                      aria-hidden
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${esOscuro ? 'left-[22px]' : 'left-0.5'}`}
                      />
                    </span>
                  </button>
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

        {/* Chat real con la central: disponible mientras hay un acompañamiento abierto */}
        {acomp && (
          <ChatConOperador
            abierto={showChat}
            onCerrar={() => abrirChat(false)}
            estado={acomp.estado}
            mensajes={chat.mensajes}
            cargando={chat.cargando}
            error={chat.error}
            onEnviar={chat.enviar}
          />
        )}
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
          onElegirEnMapa={() => {
            setShowRuta(false)
            iniciarSeleccionEnMapa()
          }}
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

      {showSosModal && (
        <ModalSOS
          estado={estadoModalSos}
          sinUbicacion={gpsEstado !== 'ok'}
          cancelando={cancelandoSos}
          onEntendido={() => {
            setShowSosModal(false)
            setSosError(false)
          }}
          onCancelar={() => void cancelarSOS()}
          onReintentar={() => void activarSOS()}
        />
      )}

      {aviso && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-heading text-white rounded-full px-5 py-2.5 text-[13px] shadow-lg flex items-center gap-2 whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-hidden">
          <CheckCircle2 size={16} className="shrink-0" /> <span className="truncate">{aviso}</span>
        </div>
      )}
    </div>
  )
}
