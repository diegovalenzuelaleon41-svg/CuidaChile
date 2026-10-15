import { Home, Users, History, User } from 'lucide-react'

export type TabId = 'inicio' | 'red' | 'actividad' | 'perfil'

interface Props {
  tab: TabId
  onTab: (t: TabId) => void
}

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'red', label: 'Red', icon: Users },
  { id: 'actividad', label: 'Actividad', icon: History },
  { id: 'perfil', label: 'Perfil', icon: User },
]

/** Navbar inferior fija estilo app de mapa: fondo blanco/95 + blur. */
export default function BottomNav({ tab, onTab }: Props) {
  return (
    <nav
      aria-label="Navegación principal"
      className="shrink-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-line dark:border-slate-700"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-current={activo ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                activo ? 'text-[#2563EB] dark:text-[#93C5FD]' : 'text-[#94A3B8] dark:text-slate-500'
              }`}
            >
              <span
                className={`w-12 h-7 rounded-full flex items-center justify-center transition-colors ${
                  activo ? 'bg-[#EFF6FF] dark:bg-slate-800' : ''
                }`}
              >
                <t.icon size={20} strokeWidth={activo ? 2.25 : 1.75} />
              </span>
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
