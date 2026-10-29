import { Shield } from 'lucide-react'

/** Isotipo spec §1: escudo con persona, + texto CuidaChile */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white shadow-[0_8px_24px_rgba(37,99,235,0.25)]"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Shield size={size * 0.62} strokeWidth={2} />
        <span
          className="absolute rounded-full bg-white"
          style={{ width: size * 0.16, height: size * 0.16, top: size * 0.24 }}
        />
        <span
          className="absolute rounded-t-full bg-white"
          style={{ width: size * 0.3, height: size * 0.16, bottom: size * 0.22 }}
        />
      </span>
      <span className="whitespace-nowrap text-[20px] font-bold tracking-tight text-[#1E293B] dark:text-white">
        CuidaChile
      </span>
    </span>
  )
}
