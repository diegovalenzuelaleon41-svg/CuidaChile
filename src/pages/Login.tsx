import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'
import Logo from '../components/Logo'

export default function Login() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  async function handleGoogleLogin() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) throw error
    } catch (err) {
      alert('No se pudo iniciar sesión con Google. Intenta de nuevo.')
      console.error(err)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(ellipse_at_top,#EFF6FF_0%,#FFFFFF_60%)] dark:bg-none dark:bg-slate-950">
      <div className="w-full max-w-[420px]">
        <div className="card p-8 md:p-12 relative">
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

          <div className="w-full flex flex-col items-center gap-2">
            <button type="button" onClick={handleGoogleLogin}
              aria-label="Iniciar sesión con Google"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[#1E293B] font-medium text-[14px] hover:bg-[#F8FAFC] transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-5.06 3.28-8.09" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.65H2.18v2.84C3.99 20.53 7.7 23 12 23" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07h2.66v1.3c-.21.53-.34 1.1-.34 1.77s.13 1.24.35 1.77z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.49 4.22 1.36l-3.15 2.65c-.87-.58-1.84-.91-2.89-.91-2.26 0-4.11 1.6-4.43 3.76H2.18v2.84c3.11-1.69 5.35-3.96 6.8-4.65z" fill="#EA4335" />
              </svg>
              <span>Continuar con Google</span>
            </button>
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
