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

/** Navbar inferior fija estilo app de mapa. El ítem activo se marca con una línea azul brillante abajo. */
export default function BottomNav({ tab, onTab }: Props) {
  return (
    <nav
      aria-label="Navegación principal"
      className="relative shrink-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-line dark:border-slate-700 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-current={activo ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                activo
                  ? 'bg-gradient-to-t from-blue-500/10 to-transparent text-[#2563EB] dark:text-[#93C5FD]'
                  : 'text-[#94A3B8] hover:text-[#64748B] dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              <span className="w-12 h-7 flex items-center justify-center">
                <t.icon size={22} strokeWidth={activo ? 2.25 : 1.75} />
              </span>
              {t.label}
              {activo && (
                <span
                  className="absolute bottom-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-blue-500 shadow-[0_0_10px_2px_rgba(59,130,246,0.7)]"
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
