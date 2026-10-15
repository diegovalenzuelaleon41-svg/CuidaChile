import { Bell, Moon, Sun } from 'lucide-react'
import Logo from '../Logo'
import { useTheme } from '../../hooks/useTheme'

interface Props {
  nombre: string
  alertaActiva: boolean
  protegido: boolean
  onSignOut: () => void
}

export default function DashboardHeader({ nombre, alertaActiva, protegido, onSignOut }: Props) {
  const { esOscuro, toggleTheme } = useTheme()
  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur transition-colors duration-300 ${
        alertaActiva ? 'bg-sos border-sos text-white' : 'bg-white/95 border-line dark:bg-slate-900/95 dark:border-slate-700'
      }`}
    >
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Logo size={36} />
          <span className="hidden sm:block w-px h-8 bg-line dark:bg-slate-700" aria-hidden />
          <div className="hidden sm:block min-w-0">
            <p className={`text-[15px] font-bold leading-tight truncate ${alertaActiva ? 'text-white' : 'text-heading dark:text-white'}`}>
              {nombre}
            </p>
            <p
              className={`text-[12px] font-semibold flex items-center gap-1.5 ${
                alertaActiva ? 'text-white' : protegido ? 'text-[#059669]' : 'text-muted dark:text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  alertaActiva ? 'bg-white animate-pulse' : protegido ? 'bg-ok' : 'bg-faint dark:bg-slate-500'
                }`}
              />
              {alertaActiva ? 'ALERTA ACTIVA' : protegido ? 'Protegido' : 'Inactivo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`sm:hidden inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${
              alertaActiva ? 'bg-white text-sos' : 'bg-[#ECFDF5] text-[#059669]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${alertaActiva ? 'bg-sos animate-pulse' : 'bg-ok animate-pulse'}`} />
            {alertaActiva ? 'ALERTA' : 'Protegido'}
          </span>
          <button
            onClick={toggleTheme}
            aria-pressed={esOscuro}
            aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={esOscuro ? 'Modo claro' : 'Modo oscuro'}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              alertaActiva ? 'hover:bg-white/10' : 'hover:bg-canvas dark:hover:bg-slate-800 text-[#475569] dark:text-slate-300'
            }`}
          >
            {esOscuro ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              alertaActiva ? 'hover:bg-white/10' : 'hover:bg-canvas dark:hover:bg-slate-800 text-[#475569] dark:text-slate-300'
            }`}
            aria-label="Notificaciones"
          >
            <Bell size={20} />
          </button>
          <button
            onClick={onSignOut}
            className={`text-[12px] font-semibold px-2 py-2 ${alertaActiva ? 'text-white' : 'text-muted dark:text-slate-400'}`}
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
