import { Bell } from 'lucide-react'
import Logo from '../Logo'

interface Props {
  alertaActiva: boolean
  protegido: boolean
}

/**
 * Header mínimo: logo, estado y notificaciones. Tema y cerrar sesión viven
 * en la pestaña Perfil para dejar la barra despejada.
 */
export default function DashboardHeader({ alertaActiva, protegido }: Props) {
  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-300 ${
        alertaActiva ? 'bg-sos border-sos text-white' : 'bg-white/90 border-line dark:bg-slate-900/80 dark:border-white/10'
      }`}
    >
      {/* ~56 px de alto: menos del 10 % de la pantalla de un teléfono */}
      <div className="mx-auto w-full max-w-6xl flex justify-between items-center gap-3 px-4 py-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size={30} textoClaro={alertaActiva} />
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
              alertaActiva
                ? 'bg-white text-sos'
                : protegido
                  ? 'bg-[#ECFDF5] text-[#059669] dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'bg-canvas text-muted dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 shrink-0 rounded-full animate-pulse ${alertaActiva ? 'bg-sos' : 'bg-ok'}`} aria-hidden />
            <span className="max-[359px]:sr-only">{alertaActiva ? 'ALERTA' : protegido ? 'Protegido' : 'Inactivo'}</span>
          </span>
        </div>
        <button
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${
            alertaActiva ? 'hover:bg-white/10' : 'hover:bg-canvas dark:hover:bg-slate-800 text-[#475569] dark:text-slate-300'
          }`}
          aria-label="Notificaciones"
        >
          <Bell size={20} />
        </button>
      </div>
    </header>
  )
}
