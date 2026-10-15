import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Fingerprint, ShieldCheck, ArrowRight, AlertCircle, Loader2, Sun, Moon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'
import Logo from '../components/Logo'

export default function Login() {
  const { session, signIn } = useAuth()
  const { esOscuro, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)
  const [bioError, setBioError] = useState(false)

  if (session) return <Navigate to="/seleccionar-rol" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/seleccionar-rol', { replace: true })
  }

  async function onBiometric() {
    setBioBusy(true)
    setBioError(false)
    await new Promise((r) => setTimeout(r, 1500))
    setBioBusy(false)
    setBioError(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(ellipse_at_top,#EFF6FF_0%,#FFFFFF_60%)] dark:bg-none dark:bg-slate-950">
      <div className="w-full max-w-[420px]">
        <div className="card p-8 md:p-12 relative">
          <button type="button" onClick={toggleTheme} aria-label={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center hover:bg-canvas dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400">
            {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="flex flex-col items-center mb-8">
            <Logo size={64} />
            <p className="mt-3 text-[14px] text-[#64748B] dark:text-slate-400 text-center">
              Plataforma integral de seguridad y prevención ciudadana.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            <div>
              <label htmlFor="email" className="label-cuida mb-2">Correo Electrónico</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500" />
                <input id="email" type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com" className="input-cuida pl-11" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label-cuida mb-2">Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500" />
                <input id="password" type={show ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="input-cuida pl-11 pr-11" />
                <button type="button" onClick={() => setShow((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-slate-500 hover:text-[#1E293B]"
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-[14px] text-[#DC2626]">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-[15px] disabled:opacity-60">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Iniciando sesión…</> : <>Iniciar sesión <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[#E2E8F0] dark:bg-slate-700" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#94A3B8] dark:text-slate-500">O inicia sesión con</span>
            <div className="flex-1 h-px bg-[#E2E8F0] dark:bg-slate-700" />
          </div>

          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={onBiometric} disabled={bioBusy}
              aria-label="Iniciar sesión con huella dactilar"
              className="w-14 h-14 rounded-full border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-[#2563EB] hover:bg-[#EFF6FF] dark:hover:bg-slate-700 hover:scale-105 transition-all disabled:opacity-60">
              {bioBusy ? <Loader2 size={24} className="animate-spin" /> : <Fingerprint size={28} strokeWidth={1.5} />}
            </button>
            {bioError && <p className="text-[12px] text-[#DC2626]">No se pudo verificar la huella</p>}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-[#94A3B8] dark:text-slate-500">
            <ShieldCheck size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Conexión segura</span>
          </div>
        </div>
        <p className="text-center mt-6 text-[14px] text-[#64748B] dark:text-slate-400">
          ¿No tienes cuenta? <Link to="/registro" className="font-semibold text-[#2563EB] dark:text-[#93C5FD] hover:underline underline-offset-4">Regístrate</Link>
        </p>
      </div>
    </main>
  )
}
