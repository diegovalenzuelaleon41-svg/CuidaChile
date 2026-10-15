import { Navigation, ShieldCheck, Siren } from 'lucide-react'

interface RutaResumen {
  origen: string
  destino: string
}

interface Props {
  nombre: string
  alertaActiva: boolean
  ruta: RutaResumen | null
  elapsed: string
}

export default function HeroEstado({ nombre, alertaActiva, ruta, elapsed }: Props) {
  return (
    <section className="bg-[linear-gradient(180deg,#FFFFFF_0%,#EFF6FF_60%,#F8FAFC_100%)] dark:bg-slate-950 dark:bg-none border-b border-line dark:border-slate-700">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8 md:py-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-slate-800 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-[#93C5FD]">
          {alertaActiva ? (
            <>
              <Siren size={13} /> Alerta en curso
            </>
          ) : (
            <>
              <ShieldCheck size={13} /> Seguridad que te acompaña
            </>
          )}
        </span>
        <h1 className="mt-3 text-[28px] md:text-[36px] font-bold tracking-tight text-heading dark:text-white">
          Hola, {nombre.split(' ')[0] || 'viajero'}
        </h1>
        <p className="mt-1 text-[15px] text-muted dark:text-slate-400">
          {alertaActiva
            ? 'Tu alerta fue enviada. Mantén la calma, un operador te contactará.'
            : ruta
              ? 'Tu ruta está vigilada. Tu círculo ve tu ubicación en tiempo real.'
              : 'Activa una ruta segura y mantén a tu círculo tranquilo.'}
        </p>
        {ruta && !alertaActiva && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-line dark:border-slate-700 px-4 py-2.5 shadow-soft">
            <Navigation size={16} className="text-brand-600 dark:text-[#93C5FD]" />
            <span className="text-[13px] font-semibold text-ink">
              {ruta.origen} → {ruta.destino}
            </span>
            <span className="text-[13px] font-bold text-brand-600 dark:text-[#93C5FD] tabular-nums">{elapsed}</span>
          </div>
        )}
      </div>
    </section>
  )
}
