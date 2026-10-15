import { useRef, type MouseEvent } from 'react'
import { Shield, ShieldCheck, Zap, Bell, Footprints, MapPin, Share2 } from 'lucide-react'

const MAX_TILT = 7

/**
 * Composición "floating phone" del hero (solo columna derecha).
 * Teléfono central con vista de la app + 4 cards flotantes alrededor.
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
      className="group relative mx-auto w-full max-w-[640px] h-[560px] md:h-[660px] lg:h-[680px]"
    >
      {/* ── Teléfono central ─────────────────────────────────────────── */}
      <div className="float-phone absolute left-1/2 top-2 md:top-4 -translate-x-1/2 z-10">
        <div
          ref={tiltRef}
          className="w-[260px] h-[540px] md:w-[300px] md:h-[620px] lg:w-[310px] lg:h-[640px] rounded-[44px] bg-[#1a1a1a] p-2 transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: 'perspective(1100px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))', boxShadow: '0 40px 80px -20px rgba(15, 23, 42, 0.25), 0 20px 40px -20px rgba(15, 23, 42, 0.15)' }}
        >
          <div className="relative flex flex-col w-full h-full bg-white rounded-[36px] overflow-hidden">
            {/* Notch */}
            <span className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-[80px] h-[22px] rounded-full bg-[#1a1a1a]" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-11 pb-2.5 bg-white shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center">
                  <Shield size={14} strokeWidth={2.25} />
                </span>
                <span className="text-[14px] font-bold text-[#1E293B]">CuidaChile</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                Estás seguro/a
              </span>
            </div>

            {/* Mapa (~55%) */}
            <div className="relative h-[240px] md:h-[300px] bg-[#F8FAFC] overflow-hidden shrink-0">
              <img src="/img/mapa-santiago.png" alt="Mapa de Santiago con ruta activa" className="w-full h-full object-cover" />
              <svg viewBox="0 0 300 260" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
                <path
                  d="M30 220 C 80 190, 110 170, 150 130 S 230 70, 268 40"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="1 9"
                />
              </svg>
              {/* Pin pulsante */}
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <span className="pin-ripple absolute w-10 h-10 rounded-full bg-[#2563EB]/30" />
                <span className="relative w-5 h-5 rounded-full bg-[#2563EB] border-[3px] border-white shadow-[0_2px_10px_rgba(37,99,235,0.6)]" />
              </span>
              <span className="absolute left-3 top-3 rounded-full bg-white/95 border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-semibold text-[#1E293B] shadow-soft">
                Ruta activa · 8 min
              </span>
            </div>

            {/* Panel inferior */}
            <div className="flex-1 bg-white rounded-t-3xl -mt-4 relative px-4 pt-3 pb-2 border-t border-[#E2E8F0]/60">
              <p className="text-[14px] font-bold text-[#0F172A]">Tu trayecto</p>
              <p className="text-[12px] text-[#64748B]">Casa → Universidad</p>
              {/* Progreso 65% */}
              <div className="relative mt-2 h-1.5 rounded-full bg-[#E2E8F0]">
                <div className="absolute inset-y-0 left-0 w-[65%] rounded-full bg-[#2563EB]" />
                <span className="absolute top-1/2 -translate-y-1/2 left-[65%] -translate-x-1/2 w-3 h-3 rounded-full bg-[#2563EB] border-2 border-white shadow" />
              </div>
              {/* SOS */}
              <div className="relative flex justify-center my-2.5">
                <span className="sos-ring absolute w-[72px] h-[72px] rounded-full bg-[#DC2626]/25" />
                <span className="sos-ring absolute w-[72px] h-[72px] rounded-full bg-[#DC2626]/20" style={{ animationDelay: '0.8s' }} />
                <div className="relative w-[72px] h-[72px] rounded-full bg-[#DC2626] border-[3px] border-white/70 shadow-[0_8px_24px_rgba(220,38,38,0.45)] flex flex-col items-center justify-center px-3 text-center text-white">
                  <span className="text-[19px] font-bold leading-[1.1] tracking-widest">SOS</span>
                  <span className="mt-0.5 text-[8px] uppercase leading-[1.1] tracking-wider opacity-90">Presionar 1.5s</span>
                </div>
              </div>
              {/* 3 acciones */}
              <div className="flex justify-center gap-6">
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

            {/* Dots */}
            <div className="flex justify-center gap-1.5 pb-3 bg-white shrink-0">
              <span className="w-5 h-1.5 rounded-full bg-[#2563EB]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#E2E8F0]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#E2E8F0]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#E2E8F0]" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 1 · superior izquierda ────────────────────────────────── */}
      <div
        className="float-card hidden md:flex absolute top-10 left-0 z-20 w-[180px] lg:w-[200px] flex-col gap-2 rounded-2xl bg-white border border-[#E2E8F0] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]"
        style={{ animationDelay: '0.5s' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Estado de protección</p>
        <div className="flex items-center gap-3">
          <span className="relative w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: 'conic-gradient(#10B981 100%, #E2E8F0 0)' }}>
            <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
              <ShieldCheck size={20} className="text-[#10B981]" strokeWidth={2} />
            </span>
          </span>
          <span>
            <span className="block text-[14px] font-bold text-[#0F172A]">Protegido</span>
            <span className="block text-[12px] text-[#64748B]">Ruta vigilada</span>
          </span>
        </div>
      </div>

      {/* ── Card 2 · media izquierda ───────────────────────────────────── */}
      <div
        className="float-card hidden md:flex absolute top-[330px] lg:top-[320px] left-0 lg:left-[-20px] z-20 w-[160px] lg:w-[180px] flex-col gap-2 rounded-2xl bg-white border border-[#E2E8F0] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]"
        style={{ animationDelay: '1s' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Tiempo de respuesta</p>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <Zap size={20} strokeWidth={1.75} />
          </span>
          <span>
            <span className="block text-[20px] font-bold leading-none text-[#0F172A]">8 seg</span>
            <span className="block mt-1 text-[12px] text-[#64748B]">promedio</span>
          </span>
        </div>
      </div>

      {/* ── Card 3 · superior derecha (coach) ───────────────────────────── */}
      <div
        className="float-card hidden md:flex absolute top-5 right-0 z-20 w-[220px] lg:w-[240px] items-start gap-2.5 rounded-2xl bg-[#2563EB] p-3.5 shadow-[0_12px_32px_rgba(37,99,235,0.35)] transition-all duration-200 group-hover:-translate-y-1"
        style={{ animationDelay: '1.5s' }}
      >
        <span className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">
          <Bell size={16} strokeWidth={1.75} />
        </span>
        <p className="text-[13px] leading-snug text-white">
          Tu círculo ya ve tu ubicación. Mantén la calma y sigue la ruta.
        </p>
      </div>

      {/* ── Card 4 · inferior derecha ──────────────────────────────────── */}
      <div
        className="float-card hidden md:flex absolute bottom-[40px] lg:bottom-[60px] right-0 lg:right-[-10px] z-20 w-[180px] lg:w-[200px] flex-col gap-1 rounded-2xl bg-white border border-[#E2E8F0] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]"
        style={{ animationDelay: '2s' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Círculo de confianza</p>
        <p className="text-[24px] font-bold leading-none text-[#0F172A]">5/5</p>
        <p className="text-[12px] text-[#64748B]">contactos activos</p>
        <span className="mt-1 inline-flex w-fit items-center rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#059669]">
          Todos conectados
        </span>
      </div>
    </div>
  )
}
