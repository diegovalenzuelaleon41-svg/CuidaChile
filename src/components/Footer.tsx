import { Globe, Mail, MessageCircle } from 'lucide-react'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-[#0B1120]">
      <div className="mx-auto max-w-7xl px-5 md:px-8 py-12">
        <div className="flex flex-col md:flex-row md:justify-between gap-10">
          <div>
            <Logo textoClaro />
            <p className="mt-3 text-[14px] text-slate-400 max-w-xs">
              Prevención, tecnología y comunidad en un solo lugar.
            </p>
            <div className="mt-4 flex gap-3 text-slate-400">
              <a href="#" aria-label="Sitio web" className="hover:text-white"><Globe size={20} /></a>
              <a href="mailto:contacto@cuidachile.cl" aria-label="Email" className="hover:text-white"><Mail size={20} /></a>
              <a href="#" aria-label="Contacto" className="hover:text-white"><MessageCircle size={20} /></a>
            </div>
          </div>
          <div className="flex gap-12 text-[14px]">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-white">Legal</span>
              <a href="#" className="text-slate-400 hover:text-white">Términos</a>
              <a href="/privacidad" className="text-slate-400 hover:text-white">Privacidad</a>
              <a href="mailto:contacto@cuidachile.cl" className="text-slate-400 hover:text-white">Contacto</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-white">Producto</span>
              <a href="#funciones" className="text-slate-400 hover:text-white">Funciones</a>
              <a href="#como-funciona" className="text-slate-400 hover:text-white">Cómo funciona</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between gap-2 text-[13px] text-slate-400">
          <p>Creada por Diego Valenzuela · Hacker-House 2026</p>
          <p>Cumplimiento Ley 19.628 y Ley 21.719 de Protección de Datos</p>
        </div>
      </div>
    </footer>
  )
}
