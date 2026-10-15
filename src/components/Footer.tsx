import { Globe, Mail, MessageCircle } from 'lucide-react'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="border-t border-[#E2E8F0] bg-white">
      <div className="mx-auto max-w-7xl px-5 md:px-8 py-12">
        <div className="flex flex-col md:flex-row md:justify-between gap-10">
          <div>
            <Logo />
            <p className="mt-3 text-[14px] text-[#64748B] max-w-xs">
              Prevención, tecnología y comunidad en un solo lugar.
            </p>
            <div className="mt-4 flex gap-3 text-[#64748B]">
              <a href="#" aria-label="Sitio web" className="hover:text-[#2563EB]"><Globe size={20} /></a>
              <a href="mailto:contacto@cuidachile.cl" aria-label="Email" className="hover:text-[#2563EB]"><Mail size={20} /></a>
              <a href="#" aria-label="Contacto" className="hover:text-[#2563EB]"><MessageCircle size={20} /></a>
            </div>
          </div>
          <div className="flex gap-12 text-[14px]">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[#1E293B]">Legal</span>
              <a href="#" className="text-[#64748B] hover:text-[#2563EB]">Términos</a>
              <a href="#" className="text-[#64748B] hover:text-[#2563EB]">Privacidad</a>
              <a href="mailto:contacto@cuidachile.cl" className="text-[#64748B] hover:text-[#2563EB]">Contacto</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[#1E293B]">Producto</span>
              <a href="#funciones" className="text-[#64748B] hover:text-[#2563EB]">Funciones</a>
              <a href="#como-funciona" className="text-[#64748B] hover:text-[#2563EB]">Cómo funciona</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[#E2E8F0] flex flex-col md:flex-row justify-between gap-2 text-[13px] text-[#94A3B8]">
          <p>Creada por Diego Valenzuela · Hacker-House 2026</p>
          <p>Cumplimiento Ley 19.628 y Ley 21.719 de Protección de Datos</p>
        </div>
      </div>
    </footer>
  )
}
