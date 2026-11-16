import { useRef, type MouseEvent } from 'react'
import { Shield, ShieldCheck, Timer, Bell, Footprints, MapPin, Share2, Search, Plus } from 'lucide-react'

const MAX_TILT = 7

/** Puntos bokeh desenfocados alrededor del teléfono: [left%, top%, tamaño px, color, blur px]. */
const BOKEH: [number, number, number, string, number][] = [
  [6, 18, 10, 'bg-[#3B82F6]/40', 2],
  [14, 62, 6, 'bg-[#94A3B8]/50', 1],
  [4, 84, 14, 'bg-[#3B82F6]/25', 4],
  [24, 92, 8, 'bg-[#94A3B8]/40', 2],
  [30, 6, 6, 'bg-[#3B82F6]/50', 1],
  [70, 4, 12, 'bg-[#94A3B8]/35', 3],
  [94, 30, 8, 'bg-[#3B82F6]/45', 2],
  [88, 50, 16, 'bg-[#3B82F6]/20', 5],
  [97, 66, 6, 'bg-[#94A3B8]/50', 1],
  [80, 96, 10, 'bg-[#3B82F6]/30', 3],
  [10, 40, 18, 'bg-[#94A3B8]/20', 6],
  [60, 98, 6, 'bg-[#3B82F6]/40', 1],
]

/** Escudos flotantes de fondo: [left%, top%, tamaño px, variante]. */
const ESCUDOS: [number, number, number, 'azul' | 'rojo'][] = [
  [8, 30, 34, 'azul'],
  [90, 22, 40, 'azul'],
  [92, 56, 30, 'azul'],
  [10, 72, 38, 'rojo'],
]

/** Trayecto de la ruta en el mapa del mockup (viewBox 300×350). La luz lo recorre con offset-path. */
const RUTA = 'M20 300 C 70 270, 110 240, 150 200 S 230 120, 272 90'

const CONTACTOS = [
  { ini: 'MP', bg: 'from-[#F472B6] to-[#DB2777]' },
  { ini: 'JR', bg: 'from-[#60A5FA] to-[#2563EB]' },
  { ini: 'CA', bg: 'from-[#FBBF24] to-[#D97706]' },
  { ini: 'LS', bg: 'from-[#34D399] to-[#059669]' },
  { ini: 'FV', bg: 'from-[#A78BFA] to-[#7C3AED]' },
]

/**
 * Composición "floating phone" del hero (solo columna derecha).
 * Teléfono central estilo iPhone con Dynamic Island + 4 cards glass que se
 * superponen a sus bordes, sobre un fondo de puntos bokeh y escudos flotantes.
 * Sin dependencias nuevas: animaciones con keyframes CSS (.float-phone/.float-card).
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

  return (
    <div
      ref={zoneRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="group relative mx-auto w-full max-w-[640px] h-[560px] md:h-[680px]"
    >
      {/* ── Fondo: bokeh + escudos ─────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {BOKEH.map(([x, y, s, color, blur]) => (
          <span
            key={`${x}-${y}`}
            className={`absolute rounded-full ${color}`}
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, filter: `blur(${blur}px)` }}
          />
        ))}
        {ESCUDOS.map(([x, y, s, v], i) => (
          <span
            key={`${x}-${y}`}
            className={`float-card hidden md:flex absolute items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.10)] ${
              v === 'rojo' ? 'text-[#DC2626]' : 'text-[#2563EB]'
            }`}
            style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${i * 0.7}s` }}
          >
            <Shield size={s * 0.45} strokeWidth={2.25} fill="currentColor" fillOpacity={0.15} />
          </span>
        ))}
      </div>

      {/* ── Teléfono central ─────────────────────────────────────────── */}
      {/* Centrado con flex: la animación float-phone usa transform y anularía un translate-x */}
      <div className="absolute inset-x-0 top-2 md:top-4 z-10 flex justify-center">
      <div className="float-phone">
        <div
          ref={tiltRef}
          className="w-[260px] h-[540px] md:w-[300px] md:h-[620px] lg:w-[310px] lg:h-[640px] rounded-[48px] bg-gradient-to-b from-[#2A2A2E] to-[#111113] p-[9px] ring-1 ring-black/40 transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: 'perspective(1100px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))', boxShadow: '0 40px 80px -20px rgba(15, 23, 42, 0.30), 0 20px 40px -20px rgba(15, 23, 42, 0.18), inset 0 0 0 2px rgba(255,255,255,0.06)' }}
        >
          <div className="relative flex flex-col w-full h-full bg-white rounded-[40px] overflow-hidden">
            {/* Dynamic Island */}
            <span className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 w-[92px] h-[26px] rounded-full bg-black" />

            {/* Mapa */}
            <div className="relative h-[300px] md:h-[350px] bg-[#F8FAFC] overflow-hidden shrink-0">
              <img src="/img/mapa-santiago.png" alt="Mapa de Santiago con ruta activa" className="w-full h-full object-cover" />
              <svg viewBox="0 0 300 350" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
                <path
                  className="ruta-avance"
                  d={RUTA}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray="0.5 10"
                />
                {/* Punto de luz que recorre la ruta (.ruta-luz) */}
                <g className="ruta-luz" style={{ offsetPath: `path('${RUTA}')` }}>
                  <circle r="10" fill="#3B82F6" opacity="0.3" />
                  <circle r="5" fill="#60A5FA" />
                  <circle r="2.5" fill="#FFFFFF" />
                </g>
              </svg>
              {/* Pin pulsante */}
              <span className="absolute left-1/2 top-[57%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <span className="pin-ripple absolute w-12 h-12 rounded-full bg-[#2563EB]/30" />
                <span className="relative w-5 h-5 rounded-full bg-[#2563EB] border-[3px] border-white shadow-[0_2px_10px_rgba(37,99,235,0.6)]" />
              </span>

              {/* Barra de búsqueda */}
              <div className="absolute inset-x-3 top-11 flex items-center gap-2 rounded-2xl bg-white/95 backdrop-blur px-3 py-2 shadow-[0_4px_16px_rgba(15,23,42,0.12)]">
                <Search size={14} className="text-[#94A3B8] shrink-0" strokeWidth={2.25} />
                <span className="flex-1 text-[13px] font-bold text-[#1E293B]">CuidaChile</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-semibold text-[#059669]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  Protegido
                </span>
              </div>
              <span className="absolute left-3 top-[92px] rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#1E293B] shadow-soft">
                Ruta activa · 8 min
              </span>
            </div>

            {/* Panel inferior */}
            <div className="flex-1 bg-white rounded-t-3xl -mt-5 relative px-4 pt-3.5 pb-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
              <p className="text-[14px] font-bold text-[#0F172A]">Tu trayecto</p>
              <p className="text-[12px] text-[#64748B]">Casa → Universidad</p>
              {/* Progreso 65% */}
              <div className="relative mt-2 h-1.5 rounded-full bg-[#E2E8F0]">
                <div className="absolute inset-y-0 left-0 w-[65%] rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB]" />
                <span className="absolute top-1/2 -translate-y-1/2 left-[65%] -translate-x-1/2 w-3 h-3 rounded-full bg-[#2563EB] border-2 border-white shadow" />
              </div>
              {/* SOS con glow */}
              <div className="relative flex justify-center my-3">
                <span className="absolute w-[76px] h-[76px] rounded-full bg-[#EF4444]/40 motion-safe:animate-ping" />
                <div className="relative w-[76px] h-[76px] rounded-full bg-gradient-to-b from-[#F87171] to-[#DC2626] border-[3px] border-white/70 shadow-[0_0_32px_rgba(239,68,68,0.65),0_8px_24px_rgba(220,38,38,0.45)] flex flex-col items-center justify-center px-3 text-center text-white">
                  <span className="text-[20px] font-extrabold leading-[1.1] tracking-widest">SOS</span>
                  <span className="mt-0.5 text-[8px] uppercase leading-[1.1] tracking-wider opacity-90">Presionar 1.5s</span>
                </div>
              </div>
              {/* 3 acciones */}
              <div className="flex justify-center gap-5">
                {[
                  { icon: Footprints, label: 'Acompañamiento' },
                  { icon: MapPin, label: 'Check-in' },
                  { icon: Share2, label: 'Compartir' },
                ].map((a) => (
                  <span key={a.label} className="flex flex-col items-center gap-1">
                    <span className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                      <a.icon size={15} strokeWidth={1.75} />
                    </span>
                    <span className="text-[10px] font-medium text-[#475569]">{a.label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Home indicator */}
            <div className="flex justify-center pb-2 pt-1 bg-white shrink-0">
              <span className="w-24 h-1 rounded-full bg-[#0F172A]/80" />
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ── Card 1 · arriba izquierda: estado ──────────────────────────── */}
      <div
        className="float-card hidden md:flex absolute top-[130px] left-0 lg:-left-[2%] z-20 w-[190px] lg:w-[200px] flex-col gap-2 glass-card p-4 transition-all duration-200 group-hover:-translate-y-1"
        style={{ animationDuration: '5s', animationDelay: '-0.8s' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Estado de protección</p>
        <div className="flex items-center gap-3">
          <span className="relative w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'conic-gradient(#10B981 100%, #E2E8F0 0)' }}>
            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <ShieldCheck size={18} className="text-[#10B981]" strokeWidth={2} />
            </span>
          </span>
          <span>
            <span className="block text-[14px] font-bold text-[#0F172A]">Protegido</span>
            <span className="block text-[12px] text-[#64748B]">Ruta vigilada</span>
          </span>
        </div>
      </div>

      {/* ── Card 2 · arriba derecha: globo azul ─────────────────────────── */}
      <div
        className="float-card hidden md:flex absolute top-0 -right-[2%] lg:-right-[4%] z-20 w-[220px] lg:w-[240px] items-start gap-2.5 rounded-2xl rounded-bl-md bg-[#2563EB]/95 backdrop-blur-md border border-white/20 p-3.5 shadow-xl shadow-[#2563EB]/30 transition-all duration-200 group-hover:-translate-y-1"
        style={{ animationDuration: '6.2s', animationDelay: '-3.1s' }}
      >
        {/* Cola del globo de texto, apuntando al teléfono */}
        <span className="absolute -bottom-2 left-4 w-4 h-4 rotate-45 rounded-sm bg-[#2563EB]/95" aria-hidden />
        <span className="relative w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">
          <Bell size={16} strokeWidth={1.75} />
        </span>
        <p className="relative text-[13px] leading-snug text-white">
          Tu círculo ve tu ubicación. Mantén la calma y sigue la ruta.
        </p>
      </div>

      {/* ── Card 3 · abajo izquierda: tiempo de respuesta ───────────────── */}
      <div
        className="float-card hidden md:flex absolute top-[290px] -left-[2%] lg:-left-[6%] z-20 w-[180px] flex-col gap-2 glass-card p-4 transition-all duration-200 group-hover:-translate-y-1"
        style={{ animationDuration: '5.6s', animationDelay: '-2.2s' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Tiempo de respuesta</p>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <Timer size={20} strokeWidth={1.75} />
          </span>
          <span>
            <span className="block text-[22px] font-bold leading-none text-[#0F172A]">8 seg</span>
            <span className="block mt-1 text-[12px] text-[#64748B]">promedio</span>
          </span>
        </div>
      </div>

      {/* ── Card 4 · abajo derecha: círculo de confianza ────────────────── */}
      <div
        className="float-card hidden md:flex absolute bottom-[50px] lg:bottom-[60px] -right-[2%] lg:-right-[5%] z-20 w-[210px] flex-col gap-2 glass-card p-4 transition-all duration-200 group-hover:-translate-y-1"
        style={{ animationDuration: '6.8s', animationDelay: '-4.6s' }}
      >
        <div className="flex items-center">
          {CONTACTOS.map((c, i) => (
            <span
              key={c.ini}
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${c.bg} border-2 border-white flex items-center justify-center text-[8px] font-bold text-white ${i > 0 ? '-ml-2' : ''}`}
            >
              {c.ini}
            </span>
          ))}
          <span className="-ml-2 w-7 h-7 rounded-full bg-[#10B981] border-2 border-white flex items-center justify-center text-white">
            <Plus size={14} strokeWidth={2.75} />
          </span>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Círculo de confianza</p>
        <div className="flex items-center justify-between">
          <span>
            <span className="block text-[24px] font-bold leading-none text-[#0F172A]">5/5</span>
            <span className="block mt-1 text-[12px] text-[#64748B]">contactos activos</span>
          </span>
          {/* Mini gráfico circular 100% */}
          <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" stroke="#E2E8F0" strokeWidth="4" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeDasharray="94.25 94.25" />
          </svg>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#059669]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          Todos conectados
        </span>
      </div>
    </div>
  )
}
