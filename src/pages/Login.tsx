import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
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
    <main className="relative min-h-screen flex items-center justify-center px-5 pt-16 pb-5 md:p-5 bg-[radial-gradient(ellipse_at_top,#EFF6FF_0%,#FFFFFF_60%)] dark:bg-none dark:bg-slate-950">
      <Link to="/"
        className="absolute top-4 left-4 md:top-6 md:left-6 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-medium text-gray-500 hover:text-blue-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-400 dark:hover:text-[#93C5FD] group">
        <ArrowLeft size={18} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
        <span>Volver al inicio</span>
      </Link>

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
              className="group relative w-full flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[14px] sm:text-[15px] font-medium text-gray-700 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400/60 dark:focus-visible:ring-offset-slate-900">
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="absolute left-4 sm:left-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
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
