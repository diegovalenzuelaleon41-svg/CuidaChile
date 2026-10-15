import { Link } from 'react-router-dom'
import { ShieldHalf, ArrowLeft, Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

/**
 * Placeholder Fase 1 (§5/§11 del spec).
 * El dashboard real del operador se construye en Fase 2.
 */
export default function OperadorPlaceholder() {
  const { esOscuro, toggleTheme } = useTheme()
  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-5 relative">
      <button type="button" onClick={toggleTheme} aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center hover:bg-canvas dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400">
        {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="card max-w-[440px] w-full p-10 text-center">
        <span className="mx-auto w-14 h-14 rounded-2xl bg-[#EFF6FF] dark:bg-slate-800 text-[#2563EB] flex items-center justify-center">
          <ShieldHalf size={28} strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-[22px] font-bold text-[#0F172A] dark:text-white">
          Panel de Operador — Próximamente
        </h1>
        <p className="mt-2 text-[14px] text-[#64748B] dark:text-slate-400">
          La consola de monitoreo (alertas, mapa en tiempo real y métricas) llega en la Fase 2.
        </p>
        <Link to="/seleccionar-rol" className="btn-secondary mt-6 w-full py-3 text-[14px]">
          <ArrowLeft size={16} /> Volver
        </Link>
      </div>
    </main>
  )
}
