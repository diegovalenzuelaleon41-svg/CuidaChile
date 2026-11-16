import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { KeyRound, Loader2, Lock, ShieldAlert, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  LARGO_PIN,
  cambiarPin,
  crearPin,
  esPinValido,
  marcarRestablecerPin,
  mensajeRechazoPin,
  restablecerPin,
} from '../../lib/pin'

/* ──────────────── Campo de 4 casillas ──────────────── */

/**
 * Un solo <input> numérico invisible sobre 4 casillas: el teclado del
 * celular, pegar y autocompletar funcionan sin saltar de foco en foco.
 * Los dígitos se muestran como puntos.
 */
export function CampoPin({
  id,
  etiqueta,
  valor,
  onCambio,
  autoFocus,
  invalido,
  deshabilitado,
}: {
  id: string
  etiqueta: string
  valor: string
  onCambio: (v: string) => void
  autoFocus?: boolean
  invalido?: boolean
  deshabilitado?: boolean
}) {
  const [enfocado, setEnfocado] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={LARGO_PIN}
        value={valor}
        autoFocus={autoFocus}
        disabled={deshabilitado}
        aria-label={etiqueta}
        aria-invalid={invalido || undefined}
        onChange={(e) => onCambio(e.target.value.replace(/\D/g, '').slice(0, LARGO_PIN))}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <div className="grid grid-cols-4 gap-3" aria-hidden>
        {Array.from({ length: LARGO_PIN }, (_, i) => {
          const actual = enfocado && (i === valor.length || (valor.length === LARGO_PIN && i === LARGO_PIN - 1))
          return (
            <span
              key={i}
              className={`flex h-16 items-center justify-center rounded-2xl border-2 bg-white/[0.04] text-[30px] font-bold transition-colors ${
                invalido
                  ? 'border-red-500/80'
                  : actual
                    ? 'border-blue-400 shadow-[0_0_0_4px_rgba(96,165,250,0.18)]'
                    : valor[i]
                      ? 'border-white/25'
                      : 'border-white/10'
              }`}
            >
              {valor[i] ? '•' : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ──────────────── Contenedor glass oscuro ──────────────── */

function ModalPin({
  icono,
  titulo,
  descripcion,
  onCerrar,
  tono = 'azul',
  children,
}: {
  icono: ReactNode
  titulo: string
  descripcion: ReactNode
  /** Sin onCerrar el modal es bloqueante (no hay X ni cierre por fondo). */
  onCerrar?: () => void
  tono?: 'azul' | 'rojo'
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 backdrop-blur-md sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-titulo"
        aria-describedby="pin-descripcion"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900/80 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl backdrop-blur-xl sm:rounded-3xl"
      >
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            tono === 'rojo' ? 'bg-red-500/15 text-red-300' : 'bg-blue-500/15 text-blue-300'
          }`}
          aria-hidden
        >
          {icono}
        </span>
        <h3 id="pin-titulo" className="mt-4 text-[22px] font-bold leading-tight">
          {titulo}
        </h3>
        <div id="pin-descripcion" className="mt-2 text-[15px] leading-snug text-slate-300">
          {descripcion}
        </div>
        {children}
      </div>
    </div>
  )
}

const BTN_PRIMARIO =
  'flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[17px] font-bold text-white transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50'
const BTN_SECUNDARIO =
  'flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:opacity-50'

function MensajeError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-3 py-2.5 text-[14px] font-medium leading-snug text-red-300">
      {children}
    </p>
  )
}

/* ──────────────── 1. Primer ingreso: crear el PIN ──────────────── */

/** Bloqueante: el usuario no sigue hasta crear su PIN. Pide repetirlo para evitar un error de tipeo. */
export function ModalCrearPin({ onCreado }: { onCreado: () => void }) {
  const [paso, setPaso] = useState<'nuevo' | 'confirmar'>('nuevo')
  const [pin, setPin] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (paso === 'nuevo') {
      if (!esPinValido(pin)) return
      setError(null)
      setPaso('confirmar')
      return
    }
    if (confirmacion !== pin) {
      setError('Los PIN no coinciden. Vuelve a crearlo.')
      setPin('')
      setConfirmacion('')
      setPaso('nuevo')
      return
    }
    setGuardando(true)
    const err = await crearPin(pin)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onCreado()
  }

  return (
    <ModalPin
      icono={<Lock size={28} />}
      titulo={paso === 'nuevo' ? 'Crea tu PIN de seguridad' : 'Repite tu PIN'}
      descripcion={
        paso === 'nuevo'
          ? 'Por tu seguridad, crea un PIN de 4 dígitos. Lo necesitarás para cancelar una alerta SOS si es una falsa alarma.'
          : 'Ingrésalo otra vez para confirmar. No lo compartas con nadie.'
      }
    >
      <form onSubmit={enviar} className="mt-6">
        {paso === 'nuevo' ? (
          <CampoPin key="nuevo" id="pin-nuevo" etiqueta="Nuevo PIN de 4 dígitos" valor={pin} onCambio={setPin} autoFocus />
        ) : (
          <CampoPin
            key="confirmar"
            id="pin-confirmar"
            etiqueta="Repite el PIN"
            valor={confirmacion}
            onCambio={setConfirmacion}
            autoFocus
            deshabilitado={guardando}
          />
        )}
        {error && <MensajeError>{error}</MensajeError>}
        <button
          type="submit"
          disabled={guardando || !esPinValido(paso === 'nuevo' ? pin : confirmacion)}
          className={`${BTN_PRIMARIO} mt-6`}
        >
          {guardando ? <Loader2 size={20} className="animate-spin" /> : null}
          {paso === 'nuevo' ? 'Continuar' : guardando ? 'Guardando…' : 'Guardar PIN'}
        </button>
        {paso === 'confirmar' && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => {
              setPaso('nuevo')
              setConfirmacion('')
            }}
            className={`${BTN_SECUNDARIO} mt-3`}
          >
            Volver
          </button>
        )}
      </form>
    </ModalPin>
  )
}

/* ──────────────── 2. Cancelar un SOS ──────────────── */

/**
 * Reemplaza la confirmación simple de "Estoy a salvo": sin el PIN correcto
 * la alerta sigue activa. onVerificar devuelve un mensaje de error o null.
 */
export function ModalPinCancelarSOS({
  onMantener,
  onVerificar,
}: {
  onMantener: () => void
  onVerificar: (pin: string) => Promise<string | null>
}) {
  const [pin, setPin] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!esPinValido(pin) || verificando) return
    setVerificando(true)
    const err = await onVerificar(pin)
    setVerificando(false)
    if (err) {
      setError(err)
      setPin('')
    }
  }

  return (
    <ModalPin
      tono="rojo"
      icono={<ShieldAlert size={28} />}
      titulo="¿Estás a salvo?"
      descripcion="Ingresa tu PIN de seguridad para cancelar la alerta. Si sigues en peligro, no la canceles."
      onCerrar={onMantener}
    >
      <form onSubmit={enviar} className="mt-6">
        <CampoPin
          id="pin-cancelar-sos"
          etiqueta="PIN de seguridad"
          valor={pin}
          onCambio={(v) => {
            setPin(v)
            if (v) setError(null)
          }}
          autoFocus
          invalido={!!error}
          deshabilitado={verificando}
        />
        {error && <MensajeError>{error}</MensajeError>}
        <button
          type="submit"
          disabled={verificando || !esPinValido(pin)}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 text-[15px] font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          {verificando && <Loader2 size={18} className="animate-spin" />}
          {verificando ? 'Verificando…' : 'Cancelar alerta'}
        </button>
        {/* La acción segura es la más visible */}
        <button type="button" onClick={onMantener} className={`${BTN_PRIMARIO} mt-3`}>
          No, mantener la alerta
        </button>
      </form>
    </ModalPin>
  )
}

/* ──────────────── 3. Mi cuenta: cambiar o restablecer ──────────────── */

type PasoPerfil = 'cambiar' | 'reautenticar' | 'restablecer'

/**
 * Cambiar el PIN (pide el actual) o, si lo olvidó, restablecerlo tras
 * volver a autenticarse: contraseña si la cuenta la tiene, si no Google.
 */
export function ModalPinPerfil({
  pasoInicial = 'cambiar',
  sosAbierto,
  onCerrar,
  onListo,
}: {
  pasoInicial?: PasoPerfil
  /** Con un SOS abierto el servidor no permite restablecer. */
  sosAbierto: boolean
  onCerrar: () => void
  onListo: (mensaje: string) => void
}) {
  const { user } = useAuth()
  const [paso, setPaso] = useState<PasoPerfil>(pasoInicial)
  const [actual, setActual] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nuevoRef = useRef<HTMLDivElement | null>(null)

  const meta = user?.app_metadata
  const proveedores: string[] = meta?.providers ?? (meta?.provider ? [meta.provider] : [])
  const conPassword = proveedores.includes('email')

  // Al completar el PIN actual, pasar al nuevo.
  useEffect(() => {
    if (paso === 'cambiar' && esPinValido(actual) && !nuevo) nuevoRef.current?.querySelector('input')?.focus()
  }, [paso, actual, nuevo])

  function irA(p: PasoPerfil) {
    setPaso(p)
    setError(null)
    setActual('')
    setNuevo('')
    setPassword('')
  }

  async function enviarCambio(e: FormEvent) {
    e.preventDefault()
    if (!esPinValido(actual) || !esPinValido(nuevo) || enviando) return
    if (actual === nuevo) {
      setError('El nuevo PIN debe ser distinto al actual.')
      return
    }
    setEnviando(true)
    const res = await cambiarPin(actual, nuevo)
    setEnviando(false)
    if (typeof res === 'string') {
      setError(res)
      return
    }
    const rechazo = mensajeRechazoPin(res, 'perfil')
    if (rechazo) {
      setError(rechazo)
      setActual('')
      return
    }
    onListo('PIN de seguridad actualizado.')
  }

  async function enviarPassword(e: FormEvent) {
    e.preventDefault()
    if (!user?.email || !password || enviando) return
    setEnviando(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: user.email, password })
    setEnviando(false)
    if (err) {
      setError('Contraseña incorrecta.')
      return
    }
    irA('restablecer')
  }

  async function verificarConGoogle() {
    setEnviando(true)
    marcarRestablecerPin()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setEnviando(false)
      setError('No pudimos abrir Google. Intenta de nuevo.')
    }
  }

  async function enviarRestablecer(e: FormEvent) {
    e.preventDefault()
    if (!esPinValido(nuevo) || enviando) return
    setEnviando(true)
    const res = await restablecerPin(nuevo)
    setEnviando(false)
    if (res.reautenticar) {
      irA('reautenticar')
      setError('La verificación expiró. Vuelve a confirmar tu identidad.')
      return
    }
    if (res.error) {
      setError(res.error)
      return
    }
    onListo('PIN de seguridad restablecido.')
  }

  if (paso === 'reautenticar') {
    return (
      <ModalPin
        icono={<KeyRound size={28} />}
        titulo="¿Olvidaste tu PIN?"
        descripcion={
          sosAbierto
            ? 'Tienes una alerta SOS activa. Por seguridad, no puedes restablecer el PIN hasta que la central la cierre.'
            : conPassword
              ? 'Por seguridad, confirma tu contraseña para crear un PIN nuevo.'
              : 'Por seguridad, vuelve a verificar tu cuenta de Google para crear un PIN nuevo.'
        }
        onCerrar={onCerrar}
      >
        {!sosAbierto &&
          (conPassword ? (
            <form onSubmit={enviarPassword} className="mt-6">
              <label htmlFor="pin-password" className="mb-2 block text-[13px] font-semibold text-slate-300">
                Contraseña de {user?.email}
              </label>
              <input
                id="pin-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                className="h-14 w-full rounded-2xl border-2 border-white/10 bg-white/[0.04] px-4 text-[16px] text-white outline-none focus:border-blue-400"
              />
              {error && <MensajeError>{error}</MensajeError>}
              <button type="submit" disabled={enviando || !password} className={`${BTN_PRIMARIO} mt-6`}>
                {enviando && <Loader2 size={20} className="animate-spin" />}
                Verificar
              </button>
            </form>
          ) : (
            <>
              {error && <MensajeError>{error}</MensajeError>}
              <button type="button" onClick={() => void verificarConGoogle()} disabled={enviando} className={`${BTN_PRIMARIO} mt-6`}>
                {enviando && <Loader2 size={20} className="animate-spin" />}
                Verificar con Google
              </button>
            </>
          ))}
        <button type="button" onClick={() => irA('cambiar')} disabled={enviando} className={`${BTN_SECUNDARIO} mt-3`}>
          Volver
        </button>
      </ModalPin>
    )
  }

  if (paso === 'restablecer') {
    return (
      <ModalPin
        icono={<KeyRound size={28} />}
        titulo="Crea un PIN nuevo"
        descripcion="Identidad verificada. Elige un PIN de 4 dígitos que recuerdes."
        onCerrar={onCerrar}
      >
        <form onSubmit={enviarRestablecer} className="mt-6">
          <CampoPin id="pin-restablecer" etiqueta="Nuevo PIN de 4 dígitos" valor={nuevo} onCambio={setNuevo} autoFocus deshabilitado={enviando} />
          {error && <MensajeError>{error}</MensajeError>}
          <button type="submit" disabled={enviando || !esPinValido(nuevo)} className={`${BTN_PRIMARIO} mt-6`}>
            {enviando && <Loader2 size={20} className="animate-spin" />}
            {enviando ? 'Guardando…' : 'Guardar PIN'}
          </button>
        </form>
      </ModalPin>
    )
  }

  return (
    <ModalPin
      icono={<KeyRound size={28} />}
      titulo="PIN de seguridad"
      descripcion="Lo pedimos para cancelar una alerta SOS. Así nadie más puede apagarla si te quitan el celular."
      onCerrar={onCerrar}
    >
      <form onSubmit={enviarCambio} className="mt-6">
        <p className="mb-2 text-[13px] font-semibold text-slate-300">PIN actual</p>
        <CampoPin
          id="pin-actual"
          etiqueta="PIN actual"
          valor={actual}
          onCambio={(v) => {
            setActual(v)
            if (v) setError(null)
          }}
          autoFocus
          invalido={!!error && !actual}
          deshabilitado={enviando}
        />
        <p className="mb-2 mt-5 text-[13px] font-semibold text-slate-300">Nuevo PIN</p>
        <div ref={nuevoRef}>
          <CampoPin id="pin-nuevo-perfil" etiqueta="Nuevo PIN" valor={nuevo} onCambio={setNuevo} deshabilitado={enviando} />
        </div>
        {error && <MensajeError>{error}</MensajeError>}
        <button type="submit" disabled={enviando || !esPinValido(actual) || !esPinValido(nuevo)} className={`${BTN_PRIMARIO} mt-6`}>
          {enviando && <Loader2 size={20} className="animate-spin" />}
          {enviando ? 'Actualizando…' : 'Actualizar PIN'}
        </button>
        <button type="button" onClick={() => irA('reautenticar')} disabled={enviando} className="mt-3 h-11 w-full text-[14px] font-semibold text-blue-300 hover:text-blue-200">
          ¿Olvidaste tu PIN?
        </button>
      </form>
    </ModalPin>
  )
}
