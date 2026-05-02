import Link from 'next/link'

interface Props {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  signal?: boolean
  href?: string
}

export default function KpiCard({ label, value, sub, accent, signal, href }: Props) {
  const base = 'rounded-xl border p-5 transition-all duration-150'
  const interactive = href ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
  const style = signal
    ? `${base} ${interactive} bg-emerald-50 border-emerald-200`
    : accent
    ? `${base} ${interactive} bg-blue-50 border-blue-200`
    : `${base} ${interactive} bg-white border-[#E2E8F0]`

  const inner = (
    <>
      <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${signal ? 'text-emerald-600' : 'text-[#64748B]'}`}>{label}</p>
      <p className={`text-3xl font-bold tabular ${signal ? 'text-emerald-700' : accent ? 'text-[#1A56DB]' : 'text-[#0F172A]'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${signal ? 'text-emerald-600' : 'text-[#64748B]'}`}>{sub}</p>}
      {href && <p className={`text-[10px] mt-2 ${signal ? 'text-emerald-500' : 'text-[#94A3B8]'}`}>자세히 보기 →</p>}
    </>
  )

  if (href) {
    return <Link href={href} className={style}>{inner}</Link>
  }

  return <div className={style}>{inner}</div>
}
