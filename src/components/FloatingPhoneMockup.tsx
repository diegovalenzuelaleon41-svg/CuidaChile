import { useEffect, useRef, type MouseEvent } from 'react'
import {
  Bell, Briefcase, Crosshair, History, Home, MapPinned, Minus, Plus, Search, ShieldCheck, Siren, Star, User, Users,
} from 'lucide-react'

const MAX_TILT = 7
/** Grados que hay que girar el celular para llegar a la inclinación máxima del mockup. */
const GIRO_MAX = 20

const ACCESOS = [
  { t: 'Casa', Icono: Home },
  { t: 'Trabajo', Icono: Briefcase },
  { t: 'Otro', Icono: Star },
]

const TABS = [
  { t: 'Inicio', Icono: Home },
  { t: 'Red', Icono: Users },
  { t: 'Actividad', Icono: History },
  { t: 'Perfil', Icono: User },
]

/**
 * Teléfono del hero con la pantalla de inicio real de la app (/usuario): mapa oscuro teñido,
 * pin "Tú" con ondas, buscador con accesos rápidos, estado y la barra Ruta + SOS.
 * Inclinación 3D fija (.telefono-3d) más la del mouse; en móvil, más suave, al 80 % y siguiendo el giroscopio.
 * Decorativo: la pantalla es aria-hidden.
 */
export default function FloatingPhoneMockup() {
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const tiltRef = useRef<HTMLDivElement | null>(null)

  function onMove(e: MouseEvent) {
    const zone = zoneRef.current
    const tilt = tiltRef.current
    if (!zone || !tilt) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    const r = zone.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    tilt.style.setProperty('--ry', `${(px * MAX_TILT * 2).toFixed(2)}deg`)
    tilt.style.setProperty('--rx', `${(-py * MAX_TILT * 2).toFixed(2)}deg`)
  }

  function onLeave() {
    tiltRef.current?.style.setProperty('--rx', '0deg')
    tiltRef.current?.style.setProperty('--ry', '0deg')
  }

  // Giroscopio (pantallas táctiles): el mockup se inclina al girar el celular en la mano.
  // Se mide contra la pose en que se abrió la página, así no importa cómo lo sostenga.
  // Donde el navegador pide permiso para el sensor (Chrome reciente) se pide sin toque: si lo concede
  // en silencio se activa; si exige un toque (iPhone/Safari) se rechaza y queda la pose fija, sin aviso al entrar.
  useEffect(() => {
    const tilt = tiltRef.current
    if (!tilt || typeof DeviceOrientationEvent === 'undefined') return
    if (!window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let base: { beta: number; gamma: number } | null = null
    let frame = 0
    let rx = 0
    let ry = 0
    const limitar = (v: number) => Math.max(-1, Math.min(1, v / GIRO_MAX)) * MAX_TILT

    function alGirar(e: DeviceOrientationEvent) {
      if (e.beta == null || e.gamma == null) return
      base ??= { beta: e.beta, gamma: e.gamma }
      let adelante = e.beta - base.beta
      let lado = e.gamma - base.gamma
      // En horizontal los ejes del sensor se cruzan con los de la pantalla.
      const angulo = screen.orientation?.angle ?? 0
      if (angulo === 90) [adelante, lado] = [-lado, adelante]
      else if (angulo === 270) [adelante, lado] = [lado, -adelante]
      rx = -limitar(adelante)
      ry = limitar(lado)
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          tilt!.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
          tilt!.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
        })
      }
    }

    // Al cambiar de orientación, la pose de referencia se vuelve a tomar.
    const reiniciar = () => {
      base = null
    }

    let activo = true
    const escuchar = () => {
      if (!activo) return
      window.addEventListener('deviceorientation', alGirar)
      screen.orientation?.addEventListener('change', reiniciar)
    }
    const pedirPermiso = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<PermissionState> })
      .requestPermission
    if (typeof pedirPermiso === 'function') {
      pedirPermiso.call(DeviceOrientationEvent).then(
        (estado) => estado === 'granted' && escuchar(),
        () => {
          /* exige un toque (iPhone): queda la pose fija */
        },
      )
    } else {
      escuchar()
    }

    return () => {
      activo = false
      window.removeEventListener('deviceorientation', alGirar)
      screen.orientation?.removeEventListener('change', reiniciar)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={zoneRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative mx-auto flex w-full max-w-[560px] justify-center pb-10 max-md:-my-[64px] max-md:scale-[0.8]"
    >
      {/* Resplandor rojo bajo la zona del SOS: el único acento cálido de la página */}
      <div aria-hidden className="pointer-events-none absolute bottom-[14%] left-1/2 h-40 w-72 -translate-x-1/4 rounded-full bg-red-600/20 blur-3xl" />

      <div className="float-phone relative">
        {/* Marco metálico + bisel negro + pantalla */}
        <div
          ref={tiltRef}
          className="telefono-3d h-[600px] w-[290px] rounded-[48px] bg-[linear-gradient(145deg,#E2E8F0_0%,#64748B_20%,#1E293B_48%,#94A3B8_72%,#334155_100%)] p-[3px] transition-transform duration-200 ease-out will-change-transform md:h-[640px] md:w-[310px]"
          style={{
            transform:
              'perspective(1000px) rotateX(calc(var(--base-rx, 0deg) + var(--rx, 0deg))) rotateY(calc(var(--base-ry, 0deg) + var(--ry, 0deg)))',
            boxShadow: '0 50px 90px -24px rgba(0, 0, 0, 0.85), 0 0 50px rgba(59, 130, 246, 0.18)',
          }}
        >
          <div className="h-full w-full rounded-[45px] bg-[#05070C] p-[6px]">
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[39px] bg-[#050B14] text-white" aria-hidden>
              {/* Barra de estado + Dynamic Island */}
              <div className="relative flex h-9 shrink-0 items-center justify-between px-6 text-[11px] font-semibold">
                <span>9:41</span>
                <span className="absolute left-1/2 top-2 h-[22px] w-[80px] -translate-x-1/2 rounded-full bg-black" />
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3.5 rounded-[2px] border border-white/80" />
                </span>
              </div>

              {/* Header de la app */}
              <div className="flex shrink-0 items-center justify-between px-3.5 pb-2">
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                    <ShieldCheck size={16} strokeWidth={2.25} />
                  </span>
                  <span className="text-[14px] font-bold">CuidaChile</span>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    SOS listo
                  </span>
                </span>
                <Bell size={16} className="text-slate-300" />
              </div>

              {/* Mapa + elementos flotantes */}
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {/* Mapa de Santiago llevado al estilo oscuro teñido de la app */}
                <img
                  src="/img/mapa-santiago.png"
                  alt=""
                  className="absolute inset-0 h-full w-full scale-125 object-cover [filter:invert(1)_hue-rotate(180deg)_brightness(0.95)_contrast(1.15)]"
                />
                <div className="absolute inset-0 bg-[#0A2A6B] mix-blend-color" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#050B14]/60 via-transparent to-[#050B14]/70" />

                {/* Buscador y accesos rápidos */}
                <div className="absolute inset-x-3 top-1.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 rounded-full border border-blue-400/20 bg-slate-900/85 py-1 pl-3 pr-1 backdrop-blur-md">
                    <Search size={13} className="text-slate-300" />
                    <span className="flex-1 text-[11px] text-slate-400">¿A dónde vas?</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                      <MapPinned size={12} />
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ACCESOS.map(({ t, Icono }) => (
                      <span
                        key={t}
                        className="flex h-6 items-center justify-center gap-1 rounded-full border border-white/10 bg-slate-900/85 text-[10px] font-medium"
                      >
                        <Icono size={11} className="text-blue-400" />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pin "Tú" con ondas */}
                <span className="absolute left-[46%] top-[48%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                  <span className="absolute h-7 w-7 rounded-full bg-blue-500/40 motion-safe:animate-ping" />
                  <span className="absolute h-7 w-7 rounded-full bg-blue-500/30 motion-safe:animate-ping [animation-delay:0.7s]" />
                  <span className="absolute h-10 w-10 rounded-full bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.7)]" />
                  <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white/90 shadow-[0_0_14px_rgba(59,130,246,0.95)]">
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                  <span className="absolute left-1/2 top-[calc(100%-6px)] -translate-x-1/2 rounded-full bg-blue-600 px-2 py-px text-[9px] font-bold">
                    Tú
                  </span>
                </span>

                {/* Controles del mapa */}
                <div className="absolute bottom-2 right-2.5 flex flex-col items-center gap-1.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-800/85">
                    <Crosshair size={14} />
                  </span>
                  <span className="flex flex-col overflow-hidden rounded-full border border-white/10 bg-slate-800/85">
                    <span className="flex h-8 w-8 items-center justify-center">
                      <Plus size={14} />
                    </span>
                    <span className="mx-2 h-px bg-white/10" />
                    <span className="flex h-8 w-8 items-center justify-center">
                      <Minus size={14} />
                    </span>
                  </span>
                </div>
              </div>

              {/* Estado + barra de acciones */}
              <div className="shrink-0 space-y-2 px-2.5 pb-2 pt-2">
                <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/15 bg-slate-900/80 px-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                    <ShieldCheck size={17} className="text-emerald-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold leading-tight">SOS listo</span>
                    <span className="block truncate text-[10px] text-slate-400">Ubicación activa</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-900/90 p-2">
                  <span className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 px-2">
                    <ShieldCheck size={17} className="shrink-0" />
                    <span className="text-[11px] font-bold leading-tight">
                      Iniciar
                      <br />
                      Ruta Segura
                    </span>
                  </span>
                  <span className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 shadow-[0_0_22px_rgba(220,38,38,0.6)]">
                    <Siren size={18} className="shrink-0" />
                    <span className="leading-none">
                      <span className="block text-[17px] font-extrabold tracking-wider">SOS</span>
                      <span className="mt-0.5 block text-[9px] font-semibold text-white/90">Mantén 1,5 s</span>
                    </span>
                  </span>
                </div>
              </div>

              {/* Navbar */}
              <div className="grid shrink-0 grid-cols-4 border-t border-white/10 bg-slate-900/95 pb-3">
                {TABS.map(({ t, Icono }, i) => (
                  <span
                    key={t}
                    className={`relative flex flex-col items-center gap-0.5 pt-1.5 text-[9px] font-semibold ${
                      i === 0 ? 'text-blue-300' : 'text-slate-500'
                    }`}
                  >
                    <Icono size={15} />
                    {t}
                    {i === 0 && (
                      <span className="absolute bottom-[-6px] h-[2px] w-7 rounded-full bg-blue-500 shadow-[0_0_8px_2px_rgba(59,130,246,0.7)]" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sombra en el suelo: le da peso al teléfono flotante */}
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 h-10 w-[260px] -translate-x-1/2 rounded-[50%] bg-black/70 blur-2xl" />
    </div>
  )
}
