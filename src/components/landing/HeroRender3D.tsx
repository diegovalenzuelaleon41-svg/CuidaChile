import { useState } from 'react'
import FloatingPhoneMockup from '../FloatingPhoneMockup'

const RENDER_3D = '/images/cuidachile-hero-3d.jpg'

/**
 * Columna derecha del hero: render 3D con resplandor, entrada y flotación (CSS: .hero-render-*).
 * Si la imagen no carga, se muestra el mockup anterior para no dejar el hero roto.
 */
export default function HeroRender3D() {
  const [fallo, setFallo] = useState(false)

  if (fallo) {
    return (
      <div className="flex justify-center">
        <FloatingPhoneMockup />
      </div>
    )
  }

  return (
    <div className="hero-render-entrada relative flex items-center justify-center lg:justify-end">
      {/* Resplandor ambiental azul detrás del render */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-[320px] w-[320px] rounded-full bg-blue-600/20 blur-[110px] sm:h-[460px] sm:w-[460px]"
      />

      {/* Flotación continua */}
      <div className="hero-render-flotar relative w-full max-w-[640px] select-none lg:-mr-10 lg:w-[115%] lg:max-w-none">
        <img
          src={RENDER_3D}
          alt="Interfaz de seguridad CuidaChile con ruta activa, botón SOS y círculo de confianza"
          onError={() => setFallo(true)}
          fetchPriority="high"
          className="h-auto w-full object-contain mix-blend-lighten drop-shadow-[0_25px_50px_rgba(0,0,0,0.75)]"
          style={{
            // Difumina suavemente los 4 bordes de la imagen para eliminar cualquier corte rectangular
            maskImage: 'radial-gradient(ellipse 75% 72% at 50% 50%, black 58%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 72% at 50% 50%, black 58%, transparent 100%)',
          }}
        />
      </div>
    </div>
  )
}
