/** Tres puntos animados: la otra persona está escribiendo. */
export default function PuntosEscribiendo({ quien, oscuro = false }: { quien: string; oscuro?: boolean }) {
  return (
    <div className="flex flex-col items-start self-start" role="status" aria-label={`${quien} está escribiendo`}>
      <div
        className={`flex items-center gap-1 rounded-2xl rounded-bl-md px-3.5 py-3 ${
          oscuro ? 'border border-slate-600/60 bg-slate-700/70' : 'border border-line bg-white dark:border-slate-600 dark:bg-slate-700'
        }`}
      >
        {[0, 160, 320].map((retraso) => (
          <span
            key={retraso}
            className="punto-escribiendo h-1.5 w-1.5 rounded-full bg-slate-400"
            style={{ animationDelay: `${retraso}ms` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}
