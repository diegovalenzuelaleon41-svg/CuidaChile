import { Clock3, Crosshair, Users } from 'lucide-react'

interface Props {
  elapsed: string
  conRuta: boolean
  acc: number | null
  nContactos: number
}

/** Tres mini-cards estilo landing: tiempo en ruta, precisión GPS, círculo. */
export default function StatsRuta({ elapsed, conRuta, acc, nContactos }: Props) {
  const items = [
    {
      icon: Clock3,
      titulo: 'Tiempo en ruta',
      valor: conRuta ? elapsed : '—',
      nota: conRuta ? 'tracking activo' : 'sin ruta activa',
    },
    {
      icon: Crosshair,
      titulo: 'Precisión GPS',
      valor: acc != null ? `±${Math.round(acc)} m` : '—',
      nota: 'alta precisión',
    },
    {
      icon: Users,
      titulo: 'Círculo',
      valor: `${nContactos}/5`,
      nota: nContactos > 0 ? 'contactos activos' : 'agrega contactos',
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it) => (
        <div key={it.titulo} className="card p-3 md:p-4">
          <span className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-[#93C5FD] flex items-center justify-center">
            <it.icon size={18} strokeWidth={1.75} />
          </span>
          <p className="mt-2 text-[18px] md:text-[22px] font-bold text-heading dark:text-white tabular-nums leading-none">
            {it.valor}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-heading dark:text-white">{it.titulo}</p>
          <p className="text-[11px] text-muted dark:text-slate-400">{it.nota}</p>
        </div>
      ))}
    </div>
  )
}
