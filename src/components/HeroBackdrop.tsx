import FondoConstelacion from './FondoConstelacion'

/**
 * Fondo del hero: base casi negra con degradados radiales, constelación neón animada (canvas) y
 * un horizonte luminoso abajo. Todo decorativo (aria-hidden) y siempre oscuro.
 */
export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050B14]" aria-hidden>
      {/* Degradado radial azul sutil: nace arriba al centro y se apaga hacia los bordes; un segundo foco detrás del teléfono */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(37,99,235,0.16),transparent_70%),radial-gradient(ellipse_50%_50%_at_70%_45%,rgba(37,99,235,0.14),transparent_70%)]" />

      {/* Malla neuronal animada */}
      <FondoConstelacion
        variante="neon"
        className="absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
      />

      {/* Horizonte luminoso al pie del hero */}
      <div className="absolute -bottom-[180px] left-1/2 h-[260px] w-[150%] -translate-x-1/2 rounded-[50%] border-t border-blue-400/40 shadow-[0_-12px_60px_rgba(59,130,246,0.35)]" />
    </div>
  )
}
