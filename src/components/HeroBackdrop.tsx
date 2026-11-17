import FondoConstelacion from './FondoConstelacion'
import MapaChileNeon from './MapaChileNeon'

/**
 * Fondo del hero, estética "cyber-tech": base casi negra con degradados radiales, constelación
 * neón animada (canvas), una órbita de luz detrás del teléfono, un horizonte luminoso abajo y el
 * mapa de Chile con nodos brillantes a la derecha. Todo decorativo (aria-hidden) y siempre oscuro.
 */
export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#050B14]" aria-hidden>
      {/* Degradados radiales: azul marino detrás del teléfono, violeta abajo a la izquierda */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_68%_42%,rgba(37,99,235,0.22),transparent_70%),radial-gradient(ellipse_45%_40%_at_12%_95%,rgba(124,58,237,0.16),transparent_70%)]" />

      {/* Malla neuronal animada */}
      <FondoConstelacion
        variante="neon"
        className="absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
      />

      {/* Órbita de luz detrás del teléfono */}
      <div className="absolute left-[64%] top-[50%] hidden h-[260px] w-[820px] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-[50%] border border-blue-400/30 shadow-[0_0_32px_rgba(59,130,246,0.35),inset_0_0_32px_rgba(59,130,246,0.18)] lg:block" />

      {/* Horizonte luminoso al pie del hero */}
      <div className="absolute -bottom-[180px] left-1/2 h-[260px] w-[150%] -translate-x-1/2 rounded-[50%] border-t border-blue-400/40 shadow-[0_-12px_60px_rgba(59,130,246,0.35)]" />

      {/* Mapa de Chile con nodos brillantes (desde 1440px: con menos ancho queda bajo las tarjetas del teléfono) */}
      <MapaChileNeon className="absolute right-[1%] top-[3%] hidden h-[100%] drop-shadow-[0_0_30px_rgba(59,130,246,0.5)] min-[1440px]:block" />
    </div>
  )
}
